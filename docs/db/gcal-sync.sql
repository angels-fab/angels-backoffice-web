-- ═══════════ 구글캘린더 ↔ Supabase(앱) 양방향 동기화 — DB 최종 상태 기록 (2026-07-09) ═══════════
-- 적용 마이그레이션: gcal_bidirectional_sync → gcal_sync_delete_guard → gcal_sync_token_rotate → gcal_sync_v2_review_fixes
-- 이 파일은 위 4개를 합친 '최종 상태' 재실행 가능 기록본(신규 환경 복구용). 엔진(GAS)은 google-apps-script/Code.gs 참고.
--
-- 설계 요약:
--  · Apps Script 시간 트리거(10분) syncCalendar()가 GCal(-30d~+365d) 조회 → calendar_sync RPC로 업서트
--    (키: 단일=iCal UID, 반복 인스턴스=UID/발생일) → 앱쪽 변경(toCreate/toUpdate/toDelete/toAppDelete) 반환
--    → GAS가 GCal 반영 → calendar_sync_ack로 새 키·수정시각 기록(CAS).
--  · 충돌 = 최신 수정 우선(LWW, updated_at vs GCal lastUpdated).
--  · 앱 삭제 → 톰스톤(calendar_del_log) → GCal 삭제. GCal 삭제 → 후보 반환 → GAS 실존 확인 후 ack로 확정(2단계).
--  · 적대적 리뷰 반영: 톰스톤 키 업서트 제외 / 클레임 시 GCal 시각 시딩 / LIKE 이스케이프·빈 제목 제외 /
--    삭제 2단계·겹침 기준·상한 100 / ack CAS·0행 톰스톤 대체·unique_violation 항목 격리.

-- 1) 동기화 컬럼
alter table public.calendar_events add column if not exists gcal_id text not null default '';
alter table public.calendar_events add column if not exists updated_at timestamptz not null default now();
create unique index if not exists calendar_events_gcal_id_uidx on public.calendar_events (gcal_id) where gcal_id <> '';

-- 앱 UPDATE 시 updated_at 자동 갱신(호출자가 명시로 바꾼 경우는 존중 — 동기화가 GCal 시각을 심을 때)
create or replace function public.calendar_touch_updated_at() returns trigger
language plpgsql as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists calendar_events_touch on public.calendar_events;
create trigger calendar_events_touch before update on public.calendar_events
  for each row execute function public.calendar_touch_updated_at();

-- 2) 앱쪽 삭제 톰스톤(동기화된 일정만)
create table if not exists public.calendar_del_log (
  id bigint generated always as identity primary key,
  gcal_id text not null,
  deleted_at timestamptz not null default now()
);
alter table public.calendar_del_log enable row level security; -- 정책 없음 = API 차단(definer 전용)

create or replace function public.calendar_log_delete() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if old.gcal_id <> '' and coalesce(current_setting('app.cal_sync_skip_del_log', true), '') <> '1' then
    insert into calendar_del_log (gcal_id) values (old.gcal_id);
  end if;
  return old;
end $$;
drop trigger if exists calendar_events_del_log on public.calendar_events;
create trigger calendar_events_del_log after delete on public.calendar_events
  for each row execute function public.calendar_log_delete();

-- 3) 동기화 토큰(값은 별도 채워짐 — 로그·레포에 미기록) + 1회용 회전 RPC
create table if not exists public.calendar_sync_config (k text primary key, v text not null);
alter table public.calendar_sync_config enable row level security;

create or replace function public.calendar_sync_rotate(new_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if length(coalesce(new_token,'')) < 32 then
    raise exception 'token too short';
  end if;
  if not exists (select 1 from calendar_sync_config where k = 'bootstrap' and v = '1') then
    raise exception 'rotation not allowed';
  end if;
  update calendar_sync_config set v = new_token where k = 'token';
  delete from calendar_sync_config where k = 'bootstrap';
  return jsonb_build_object('ok', true);
end $$;

-- 4) LIKE 이스케이프 헬퍼
create or replace function public.cal_like_escape(s text) returns text
language sql immutable as $$
  select replace(replace(replace(s, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- 5) 동기화 RPC (v2 — 적대적 리뷰 반영 최종본)
create or replace function public.calendar_sync(payload jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_token text; ev jsonb; r record;
  v_from text; v_to text;
  n_new int := 0; n_upd int := 0; n_claim int := 0; n_skip_del int := 0;
  n_events int;
  keys text[]; out_create jsonb; out_update jsonb; out_delete jsonb; out_appdel jsonb;
begin
  select v into v_token from calendar_sync_config where k = 'token';
  if v_token is null or (payload->>'token') is distinct from v_token then
    raise exception 'invalid sync token';
  end if;
  v_from := payload->'window'->>'from';
  v_to   := payload->'window'->>'to';
  if v_from is null or v_to is null then raise exception 'missing window'; end if;

  n_events := coalesce(jsonb_array_length(payload->'events'), 0);
  select coalesce(array_agg(e->>'key'), '{}') into keys from jsonb_array_elements(payload->'events') e;

  -- (a) GCal → 앱 업서트. 삭제 대기(톰스톤) 키는 전부 건너뜀
  for ev in select * from jsonb_array_elements(payload->'events') loop
    if exists (select 1 from calendar_del_log d where d.gcal_id = ev->>'key') then
      n_skip_del := n_skip_del + 1;
      continue;
    end if;
    select * into r from calendar_events where gcal_id = ev->>'key';
    if found then
      if (r.title, r.loc, r.all_day, r.start_at, r.end_at) is distinct from
         (ev->>'title', coalesce(ev->>'loc',''), (ev->>'allDay')::boolean, ev->>'start', ev->>'end') then
        if (ev->>'updated')::timestamptz > r.updated_at then
          update calendar_events set
            title = ev->>'title', loc = coalesce(ev->>'loc',''),
            all_day = (ev->>'allDay')::boolean, start_at = ev->>'start', end_at = ev->>'end',
            updated_at = (ev->>'updated')::timestamptz
          where id = r.id;
          n_upd := n_upd + 1;
        end if;
      end if;
    else
      select * into r from calendar_events
       where gcal_id = '' and repeat = 'none'
         and start_at = ev->>'start' and end_at = ev->>'end'
         and all_day = (ev->>'allDay')::boolean
         and (trim(title) = trim(ev->>'title')
              or (trim(ev->>'title') <> '' and trim(title) <> '' and
                  (trim(title) like cal_like_escape(trim(ev->>'title')) || '%'
                   or trim(ev->>'title') like cal_like_escape(trim(title)) || '%')))
       order by id limit 1;
      if found then
        update calendar_events set gcal_id = ev->>'key', updated_at = (ev->>'updated')::timestamptz
         where id = r.id;
        n_claim := n_claim + 1;
      else
        insert into calendar_events (title, loc, all_day, start_at, end_at, repeat, repeat_until, series_id, created_by, gcal_id, updated_at)
        values (ev->>'title', coalesce(ev->>'loc',''), (ev->>'allDay')::boolean, ev->>'start', ev->>'end',
                'none', '', '', '구글캘린더', ev->>'key', (ev->>'updated')::timestamptz);
        n_new := n_new + 1;
      end if;
    end if;
  end loop;

  -- (b) GCal에서 사라진 '후보'만 반환(겹침 기준·상한 100) — GAS가 실존 확인 후 ack로 확정
  if n_events = 0 then
    out_appdel := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'key', t.gcal_id)), '[]') into out_appdel
      from (
        select id, gcal_id from calendar_events
         where gcal_id <> '' and end_at >= v_from and start_at <= v_to
           and not (gcal_id = any(keys))
         order by id limit 100
      ) t;
  end if;

  -- (c) 앱 → GCal 반영 목록(snap = ack CAS용 스냅샷)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'title', title, 'loc', loc, 'allDay', all_day, 'start', start_at, 'end', end_at,
           'snap', updated_at::text)), '[]')
    into out_create
    from calendar_events
   where gcal_id = '' and repeat = 'none' and created_by not like '이관%'
     and start_at >= v_from and start_at <= v_to;

  select coalesce(jsonb_agg(jsonb_build_object(
           'key', c.gcal_id, 'title', c.title, 'loc', c.loc, 'allDay', c.all_day, 'start', c.start_at, 'end', c.end_at,
           'snap', c.updated_at::text)), '[]')
    into out_update
    from calendar_events c
    join jsonb_array_elements(payload->'events') e on e->>'key' = c.gcal_id
   where c.updated_at > (e->>'updated')::timestamptz
     and (c.title, c.loc, c.all_day, c.start_at, c.end_at) is distinct from
         (e->>'title', coalesce(e->>'loc',''), (e->>'allDay')::boolean, e->>'start', e->>'end');

  select coalesce(jsonb_agg(jsonb_build_object('logId', id, 'key', gcal_id)), '[]')
    into out_delete from calendar_del_log;

  return jsonb_build_object(
    'toCreate', out_create, 'toUpdate', out_update, 'toDelete', out_delete, 'toAppDelete', out_appdel,
    'stats', jsonb_build_object('pulledNew', n_new, 'pulledUpdated', n_upd, 'claimed', n_claim,
                                'skippedTombstoned', n_skip_del));
end $$;

create or replace function public.calendar_sync_ack(payload jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_token text; it jsonb; n int; v_ids bigint[];
begin
  select v into v_token from calendar_sync_config where k = 'token';
  if v_token is null or (payload->>'token') is distinct from v_token then
    raise exception 'invalid sync token';
  end if;

  for it in select * from jsonb_array_elements(coalesce(payload->'created', '[]'::jsonb)) loop
    begin
      update calendar_events
         set gcal_id = it->>'key',
             updated_at = case when updated_at::text = (it->>'snap') then (it->>'updated')::timestamptz else updated_at end
       where id = (it->>'id')::bigint;
      get diagnostics n = row_count;
      if n = 0 then
        insert into calendar_del_log (gcal_id) values (it->>'key');
      end if;
    exception when unique_violation then null;
    end;
  end loop;

  for it in select * from jsonb_array_elements(coalesce(payload->'updated', '[]'::jsonb)) loop
    begin
      update calendar_events
         set gcal_id = coalesce(nullif(it->>'newKey',''), gcal_id),
             updated_at = case when updated_at::text = (it->>'snap') then (it->>'updated')::timestamptz else updated_at end
       where gcal_id = it->>'key';
    exception when unique_violation then null;
    end;
  end loop;

  select coalesce(array_agg((x->>0)::bigint), '{}') into v_ids
    from jsonb_array_elements(coalesce(payload->'appDeleteIds', '[]'::jsonb)) x;
  if array_length(v_ids, 1) > 0 then
    perform set_config('app.cal_sync_skip_del_log', '1', true);
    delete from calendar_events where id = any(v_ids) and gcal_id <> '';
    perform set_config('app.cal_sync_skip_del_log', '', true);
  end if;

  delete from calendar_del_log where id in (
    select (x->>0)::bigint from jsonb_array_elements(coalesce(payload->'clearedLogIds', '[]'::jsonb)) x);
  return jsonb_build_object('ok', true);
end $$;

-- 6) 실행 권한(함수 정의 뒤에 위치 — 재실행 가능 순서)
grant execute on function public.calendar_sync(jsonb) to anon, authenticated;
grant execute on function public.calendar_sync_ack(jsonb) to anon, authenticated;
grant execute on function public.calendar_sync_rotate(text) to anon, authenticated;
