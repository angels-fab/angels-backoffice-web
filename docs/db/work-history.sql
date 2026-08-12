-- 업무 변경 이력 (개선요청 66, 2026-08-12)
--
-- 왜 트리거인가: 업무를 고치는 경로가 **두 개**다.
--   ① 상태 배치 변경 RPC work_update_statuses (드래그·KPI 존 이동)
--   ② 수정 폼 → src/api/works.ts updateWork (works 테이블 직접 UPDATE)
-- RPC 안에만 INSERT 를 넣으면 ②가 조용히 새서 "이력이 가끔 비는" 신뢰 문제가 된다.
-- 트리거는 두 경로를 한 곳에서 잡고 **앱 코드 변경이 0줄**이다.
-- (트리거 관습은 이미 이 DB 에 있다 — calendar_log_delete 와 같은 모양: plpgsql · SECURITY DEFINER
--  · search_path 고정 · current_setting 탈출구)
--
-- 기록하는 것: 상태 · 담당자 · 예정일 · Remind · 내용 · 서식 · 완료일(상태가 안 바뀐 경우만)
-- 기록하지 않는 것: 순서(sort_order) · 첨부 · 구분 · 부서 · 장소
--
-- ⚠ 소급 불가 — 켜는 날부터만 쌓인다. 그래서 화면보다 기록을 먼저 켠다.
--   이력이 비어 있는 업무는 '안 바뀐 것'이 아니라 '기록 시작 전'일 수 있다. 화면을 만들 때
--   이 표의 생성일(= 기록 시작일)을 함께 알려야 한다. 가짜 기준선 행을 넣지는 않는다.

create table if not exists public.work_history (
  id     bigint generated always as identity primary key,
  /** works.num — FK 를 걸지 않는다: 업무는 소프트삭제(deleted_at)라 실제로 지워지는 일이 드물지만,
      휴지통 비우기로 행이 사라져도 "그때 이런 일이 있었다"는 기록은 남는 편이 맞다 */
  num    bigint not null,
  /** 상태 · 담당자 · 예정일 · Remind · 내용 · 서식 · 완료일 */
  field  text   not null,
  prev   text   not null default '',
  next   text   not null default '',
  /** 바꾼 사람(profiles.name). 스크립트·서비스롤 경로면 '시스템' */
  author text   not null default '',
  at     timestamptz not null default now()
);

comment on table public.work_history is '업무 변경 이력 — works 트리거가 기록. 앱은 읽기만 한다(개선요청 66)';

-- 한 업무의 이력을 최근순으로 뽑는 것이 유일한 조회 패턴이다
create index if not exists work_history_num_at_idx on public.work_history (num, at desc);

alter table public.work_history enable row level security;

-- 읽기: 팀원 이상(업무 자체는 누구나 읽지만, 누가 언제 무엇을 바꿨는지는 내부 기록이다)
drop policy if exists work_history_read on public.work_history;
create policy work_history_read on public.work_history for select to authenticated using (is_member());

-- 쓰기 정책을 **일부러 두지 않는다** — 넣고 지우고 고치는 것은 아래 트리거(SECURITY DEFINER)만
-- 할 수 있어야 이력이 기록으로서 값을 갖는다.

create or replace function public.work_log_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  who text;
begin
  -- 이관·백업 스크립트가 대량 이력을 만들지 않게 하는 탈출구(캘린더 동기화와 같은 관습)
  --   select set_config('app.work_skip_history', '1', true);  -- 그 트랜잭션 안에서만
  if coalesce(current_setting('app.work_skip_history', true), '') = '1' then
    return new;
  end if;

  -- 휴지통에 넣거나 되살리는 것 자체는 이력이 아니고, 휴지통에 있는 동안의 변화도 기록하지 않는다
  -- (넣었다 뺐다 하는 왕복이 가짜 이력을 만들면 안 된다)
  if coalesce(old.deleted_at, '') is distinct from coalesce(new.deleted_at, '') then
    return new;
  end if;
  if coalesce(new.deleted_at, '') <> '' then
    return new;
  end if;

  who := coalesce(nullif(my_name(), ''), '시스템');

  if coalesce(old.status, '') is distinct from coalesce(new.status, '') then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '상태', coalesce(old.status, ''), coalesce(new.status, ''), who);
  end if;

  if coalesce(old.mgr, '') is distinct from coalesce(new.mgr, '') then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '담당자', coalesce(old.mgr, ''), coalesce(new.mgr, ''), who);
  end if;

  if coalesce(old.plan, '') is distinct from coalesce(new.plan, '') then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '예정일', coalesce(old.plan, ''), coalesce(new.plan, ''), who);
  end if;

  -- Remind 를 빼면 안 된다: 완료 카드를 Remind 존으로 옮기면 status 는 '완료' 그대로이고
  -- remind 만 바뀐다 — 분명히 카드를 옮겼는데 이력이 한 줄도 안 남는 일이 생긴다
  if coalesce(old.remind, false) is distinct from coalesce(new.remind, false) then
    insert into work_history (num, field, prev, next, author)
    values (new.num, 'Remind',
            case when coalesce(old.remind, false) then '켜짐' else '꺼짐' end,
            case when coalesce(new.remind, false) then '켜짐' else '꺼짐' end, who);
  end if;

  -- 본문 비교는 **반드시 task** 로 한다.
  --   · task = '제목줄\n본문' 평문이고 두 경로 모두 **항상** 갱신한다(Work/index.tsx confirmEdit).
  --   · content_fmt 는 ProseMirror 직렬화 JSON(`{"version":1,"doc":{...}}`)이고 **제목이 빠져 있다**.
  -- 처음엔 coalesce(nullif(content_fmt,''), task) 로 '보이는 본문'을 비교했는데 두 가지가 깨졌다:
  --   ① 서식이 붙은 업무(19건)의 제목만 고치면 content_fmt 가 그대로라 이력이 한 줄도 안 남는다
  --   ② 평문→서식 첫 저장에서 prev 는 평문, next 는 JSON 덩어리가 그대로 박혀 사람이 못 읽는다
  if old.task is distinct from new.task then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '내용', coalesce(old.task, ''), coalesce(new.task, ''), who);
  end if;

  -- 서식만 바뀐 경우(글자는 그대로, 굵게·색만) — JSON 원문을 남기지 않고 '바뀌었다'만 남긴다
  if old.content_fmt is distinct from new.content_fmt
     and old.task is not distinct from new.task then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '서식', '', '본문 서식 변경', who);
  end if;

  -- 완료일은 보통 상태 전이에 딸려오지만(그때는 상태 줄이 이미 말해 준다), **상태가 그대로인데
  -- 완료일만 움직이는 경로가 실제로 있다** — 이미 완료된 업무를 다시 저장하면 updateWork 가
  -- end_date 를 오늘로 덮어쓴다(src/api/works.ts 의 applyStatusRules + 완료가 아닐 때만 걸리는 가드).
  -- 그 조용한 변화를 잡으라고 넣는 줄이다.
  if coalesce(old.end_date, '') is distinct from coalesce(new.end_date, '')
     and coalesce(old.status, '') is not distinct from coalesce(new.status, '') then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '완료일', coalesce(old.end_date, ''), coalesce(new.end_date, ''), who);
  end if;

  return new;
end
$function$;

drop trigger if exists works_log_changes on public.works;
create trigger works_log_changes
  after update on public.works
  for each row
  execute function public.work_log_changes();
