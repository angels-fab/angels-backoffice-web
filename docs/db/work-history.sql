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
-- 기록하는 것: 상태 · 담당자 · 예정일 · Remind · 내용 · 완료일(상태가 안 바뀐 경우만)
-- 기록하지 않는 것: 순서(sort_order) · 첨부 · 구분 · 부서 · 장소
--                  · **서식**(형광펜·글자색·굵게) · **공백만 바뀐 저장**(띄어쓰기·줄바꿈·빈 줄)
--   → 2026-08-13 사용자 지시: "내용이 변하지 않으면 이력에 남기지 마라. 삭제되거나 추가되는 등
--     내용상 중요한 변경만 남겨라." 무엇을 지웠는지·왜인지는 아래 '내용' 비교 주석에.
--
-- ⚠ 소급 불가 — 켜는 날부터만 쌓인다. 그래서 화면보다 기록을 먼저 켠다.
--   이력이 비어 있는 업무는 '안 바뀐 것'이 아니라 '기록 시작 전'일 수 있다. 화면을 만들 때
--   이 표의 생성일(= 기록 시작일)을 함께 알려야 한다. 가짜 기준선 행을 넣지는 않는다.

create table if not exists public.work_history (
  id     bigint generated always as identity primary key,
  /** works.num — FK 를 걸지 않는다: 업무는 소프트삭제(deleted_at)라 실제로 지워지는 일이 드물지만,
      휴지통 비우기로 행이 사라져도 "그때 이런 일이 있었다"는 기록은 남는 편이 맞다 */
  num    bigint not null,
  /** 상태 · 담당자 · 예정일 · Remind · 내용 · 완료일
      ('서식'은 2026-08-13 폐지 — 옛 행 3줄이 남아 있을 수 있다) */
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
  who   text;
  k_old text;
  k_new text;
  /* 본문 비교에서 **지워 놓고 볼** 것들 — 이 잣대로 같으면 "글자는 그대로"로 본다.
     원문은 건드리지 않는다. 아래 셋은 비교에만 쓴다.

     invis    — NBSP(U+00A0)는 보통 공백으로 바꾸고, 제로폭 문자(U+200B ZWSP·U+200C·U+200D·U+FEFF)는
                지운다(translate 의 to 가 짧으면 나머지는 삭제된다). 붙여넣기로 실제로 들어온다.
     p_inline — **글자 뒤**에 붙은 가로 공백만 지운다. 앞이 공백이나 줄바꿈이면 안 걸리므로
                **줄 앞 들여쓰기는 살아남는다** — 이 앱에서 줄 앞 2칸은 하위단계 위계다
                (richContent.tsx lineMeta, 살아 있는 업무 156건 중 128건이 들여쓰기를 쓴다).
     p_blank  — 빈 줄(공백만 있는 줄 포함)을 접는다. 뒤에 줄바꿈이 오는 경우만 지우므로 줄 수는 지킨다.

     [[:space:]] 를 **일부러 안 쓴다**: 이 DB 는 ICU 로케일이라 그 클래스에 NBSP 가 들어가지만
     libc 로케일(로컬 supabase start)에서는 안 들어간다. 기록 규칙이 로케일에 흔들리면 안 된다.
     chr() 로 적는 이유: 소스에 보이지 않는 문자를 그대로 박아 두면 다음 사람이 손댈 수 없다. */
  invis    constant text := chr(160) || chr(8203) || chr(8204) || chr(8205) || chr(65279);
  p_inline constant text := '(?<=[^ ' || chr(9) || chr(10) || '])[ ' || chr(9) || ']+';
  p_blank  constant text := chr(10) || '[ ' || chr(9) || ']*(?=' || chr(10) || ')';
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
  --
  -- 비교는 원문이 아니라 **정규화한 잣대(k_old/k_new)** 로 한다(2026-08-13 사용자 지시).
  --   "띄어쓰기만 해도 이력에 남는다 / 내용이 변하지 않으면 남기지 마라 /
  --    삭제되거나 추가되는 등 내용상 중요한 변경만 남겨라"
  -- 두 요구를 **동시에** 지켜야 한다. 그래서 지우는 것과 지키는 것을 갈랐다.
  --   지운다: 줄 안 띄어쓰기·줄 끝 공백·빈 줄·NBSP·제로폭 문자
  --   지킨다: **줄바꿈과 줄 앞 들여쓰기** — task 는 `제목줄\n본문`이라 줄바꿈을 지우면 제목과 본문이
  --           한 덩어리가 되고(제목이 바뀐 편집이 사라진다), 줄 앞 2칸은 하위단계 위계다.
  -- 처음엔 공백을 전부 지웠다가 되돌렸다: 그러면 '항목 한 줄 추가'·'제목 경계 이동'·'하위단계 강등'이
  -- 전부 0줄이 된다 — 사용자가 "추가·삭제는 남기라"고 한 바로 그 경우다. 이력은 소급이 안 되므로
  -- 안 남긴 줄은 영영 복구되지 않고, 남긴 줄은 화면에서 걸러낼 수 있다(비대칭이라 보수적으로).
  -- **남기는 값(prev/next)은 원문 그대로다** — k_* 는 비교용 잣대이지 저장 형식이 아니다.
  k_old := btrim(regexp_replace(regexp_replace(
             translate(replace(coalesce(old.task, ''), chr(13), ''), invis, ' '),
             p_inline, '', 'g'), p_blank, '', 'g'), ' ' || chr(9) || chr(10));
  k_new := btrim(regexp_replace(regexp_replace(
             translate(replace(coalesce(new.task, ''), chr(13), ''), invis, ' '),
             p_inline, '', 'g'), p_blank, '', 'g'), ' ' || chr(9) || chr(10));

  if k_old is distinct from k_new then
    insert into work_history (num, field, prev, next, author)
    values (new.num, '내용', coalesce(old.task, ''), coalesce(new.task, ''), who);
  end if;

  -- 서식(content_fmt)은 **기록하지 않는다** — 형광펜·글자색·굵게는 글자를 바꾸지 않는다.
  -- 게다가 이 블록은 서식을 건드리지 않아도 떴다: 서식 있는 업무(19건)는 저장할 때마다
  -- contentFmt 를 다시 보내는데(index.tsx contentFmtForSave), 트리거는 JSON 문자열을 그대로
  -- 비교하므로 담당자만 바꿔도 '본문 서식 변경' 한 줄이 붙었다.
  -- (2026-08-13 사용자 지시로 제거. 되살리지 말 것)
  -- 대가로 하나 잃는다: **문단↔목록 전환·목록 단계 변경**은 평문 task 가 같아서 이제 아무 데도 안 남는다
  -- (에디터가 목록 마커를 평문에 안 넣는다 — RichContentEditor 의 getText({blockSeparator})).

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
