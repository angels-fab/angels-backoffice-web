import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Popper from '@mui/material/Popper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import LockIcon from '@mui/icons-material/Lock'
import HistoryIcon from '@mui/icons-material/History'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { mergeSx } from '@/components/ds/sxMerge'
import { iconSize, motion, radius, shadow, typescale, weight } from '@/theme/tokens'
import { StatusChip, focusRingSx } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import { isWorkNew } from '@/utils/newPost'
import type { WorkItem } from '@/types'
import { taskTitle, taskLink, catKind, catIcon, toneVar, toneCss, toneBody, toneBorderCss, toneBorderHoverCss, toneBorderSelCss, toneRingCss, toneRingHoverCss } from './workMeta'
import ManagerChip from '@/components/ds/ManagerChip'
import type { CardTone } from './workMeta'
import { workBodyLines } from './richContent'
import { CARD_SKIP } from './cardInteractive'
import SubLine from './SubLine'
import WorkPinButton from './WorkPinButton'
import WorkAttachments from './WorkAttachments'
import TaskLinkButton from './TaskLinkButton'
import WorkCardComments from './WorkCardComments'
import { useAppSelector } from '@/store/hooks'
import WorkHistoryList from './WorkHistoryList'
import type { WorkHistoryRow } from '@/api/works'

export type { CardTone } from './workMeta'

export interface TaskAccordionProps {
  t: WorkItem
  /** 카드 상태 계층 색 — 업무 상태의 KPI 대표색(D3: 진행중 그린·보류 앰버·완료 블루·Remind 퍼플) */
  tone: CardTone
  /** 선택 여부 — 같은 대표색의 강한 테두리·배경·링(호버보다 우선) */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
  /**
   * 첨부 버튼처럼 **카드 안의 버튼**을 눌렀을 때 이 카드를 선택시킨다(해제는 하지 않음).
   * 그리드 셀의 선택 처리는 `closest('button, a, …')`로 버튼 클릭을 건너뛰기 때문에,
   * 버튼을 눌러도 카드가 선택되게 하려면 이 경로가 따로 필요하다.
   */
  onRequestSelect?: () => void
  /** 이 업무의 변경 이력(최신순) — 없으면 시계 버튼 자체가 안 뜬다(개선요청 66) */
  history?: WorkHistoryRow[]
}

/**
 * 업무 카드 — 아코디언 없이 항상 내용 표시(정적).
 * 머리: 구분칩 · 제목 · 담당자칩 · 별
 * 본문: 내용 불릿·관련링크, 그 아래 메타 줄(부서 · 발의·예정·완료 · 첨부 클립+건수).
 * (완료·수정·삭제는 더보기 메뉴 대신 드래그 상태변경·더블클릭 수정·휴지통 드롭으로 수행)
 */
/**
 * 메타 줄의 라벨+값 한 쌍 — 라벨은 부차(11px 보조톤), 값은 부수(13px 주톤).
 *
 * 라벨과 값을 **두 칸으로 나눈다**(한 줄 안에 이어 쓰지 않음). 값이 접힐 때 둘째 줄이 라벨 밑이
 * 아니라 값의 시작점에 맞춰 들어가야 하기 때문(행잉 인덴트). 라벨이 전부 두 글자라 칸 폭이 같아
 * 항목끼리도 세로로 정렬된다. gap은 공백 한 칸보다 조금 넓게 — 11px 글자의 공백은 3px라 붙어 보였다.
 */
/**
 * 메타 줄 오른쪽 아이콘 버튼(이력·첨부) 공통 모양 — 테두리 없이 아이콘+숫자만.
 * 존재는 채도가 아니라 크기로 알린다(본문과 같은 14px).
 */
const metaBtnSx = (th: Theme) => ({
  display: 'inline-flex', alignItems: 'center', gap: '4px',
  px: 0.75, py: 0.375, font: 'inherit', cursor: 'pointer',
  fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight,
  color: 'text.secondary', bgcolor: 'transparent', border: 'none',
  borderRadius: `${radius.chip}px`,
  transition: `background-color ${motion.base}, color ${motion.base}`,
  '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.09), color: 'text.primary' },
  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
})

function MetaItem({ label, value, sx }: { label: string; value: string; sx?: SxProps<Theme> }) {
  return (
    <Box sx={mergeSx({ display: 'flex', gap: '6px', alignItems: 'baseline' }, sx)}>
      <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: typescale.body.size, color: 'text.primary', lineHeight: 1.5, wordBreak: 'keep-all' }}>{value}</Typography>
    </Box>
  )
}

export default function TaskAccordion({ t, tone, selected = false, onSelect, onRequestSelect, history = [] }: TaskAccordionProps) {
  const subs = workBodyLines(t)
  const link = taskLink(t)
  const atts = t.attachments || []
  const [attAnchor, setAttAnchor] = useState<HTMLElement | null>(null)
  /**
   * 코멘트 팝업(개선요청 68) — 처음엔 카드 안 펼침(A안)이었는데 **팝업으로 바꿨다**(사용자 지시 2026-08-13).
   * 스레드는 카드를 아래로 '확장'하는 것이 아니라 '임시로 열어 보는' 것이라, 펼칠 때 옆 카드가
   * 밀리면 안 된다. 카드 밖(붉은 네모 = 카드 아래 오른쪽)에 띄우면 격자는 한 픽셀도 안 움직인다.
   */
  const [cmtAnchor, setCmtAnchor] = useState<HTMLElement | null>(null)
  // 지워져 자리만 남은 코멘트("삭제된 코멘트입니다")는 건수에 안 넣는다 — 배지는 읽을 것의 수다
  const commentCount = useAppSelector((s) => s.workComments.items.filter((c) => c.num === t.num && !c.deleted).length)
  const [histAnchor, setHistAnchor] = useState<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  /**
   * 첨부 팝업을 바깥 클릭으로 닫을 때, 그 클릭이 카드 선택까지 건드리지 않게 **한 번만 삼킨다**.
   *
   * 카드 안에서 stopPropagation 하는 것으로는 안 된다 — 선택을 처리하는 그리드 셀이
   * `onClickCapture`(캡처 단계)라 카드의 버블 핸들러보다 먼저 실행된다(ReorderableTaskGrid:525).
   * 그래서 document 캡처에 1회용 리스너를 걸어 React가 보기 전에 끊는다.
   * 대상은 **이 카드 안의 클릭으로 한정** — 사이드바 등 다른 곳 클릭은 평소대로 동작해야 한다.
   */
  const swallowNextClickInCard = () => {
    const el = cardRef.current
    if (!el) return
    let timer = 0
    // 정리는 **click이 온 시점**에 한다. setTimeout(0)으로 걷으면 실제 클릭(mousedown→mouseup→click,
    // 사람 손은 50~150ms)이 도착하기 전에 리스너가 사라져 아무것도 못 막는다.
    // (합성 이벤트를 같은 틱에 쏘면 이 틈이 없어서 테스트만 통과했다 — 실제로는 선택이 풀렸음)
    const swallow = (ev: MouseEvent) => {
      document.removeEventListener('click', swallow, true)
      window.clearTimeout(timer)
      if (!(ev.target instanceof Node) || !el.contains(ev.target)) return
      // 카드 안의 버튼·링크는 살린다 — 그리드의 선택 판정은 어차피 CARD_SKIP 으로 이들을 건너뛰므로
      // 삼킬 이유가 없는데, 삼키면 팝업을 닫는 김에 누른 링크·별의 **첫 클릭이 조용히 사라진다**
      // (preventDefault 가 앵커의 새 탭 열기를 취소한다). 개선요청 62로 링크가 클립 바로 옆에 오면서
      // '첨부 보고 → 링크 열기'가 흔한 동선이 됐다.
      if (ev.target instanceof Element && ev.target.closest(CARD_SKIP)) return
      ev.stopPropagation(); ev.preventDefault()
    }
    document.addEventListener('click', swallow, true)
    // 클릭이 끝내 안 오는 경우(드래그로 빠짐·포커스 이동 등) 대비 안전망
    timer = window.setTimeout(() => document.removeEventListener('click', swallow, true), 700)
  }
  // 부서·날짜는 제목줄 칩에서 **내용 아래 메타 줄**로 옮겼다(사용자 확정 2026-07-26).
  // 칩이 4개면 글자 처리가 3가지로 갈려 시끄러웠고, 부서·날짜는 "걸러낼 분류"가 아니라 그냥 값이라
  // 칩이라는 그릇이 맞지 않았다.
  const deptMeta = (t.dept || '').trim() ? { label: '부서', value: t.dept as string } : null
  const dateMetas: { label: string; value: string }[] = [
    { label: '발의', value: t.start ? fmtDate(t.start) : '' },
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())
  // hasMeta 는 없앴다 — 코멘트 버튼이 늘 있어 메타 줄의 표시 조건 자체가 사라졌다(개선요청 68)

  return (
    <Box
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`업무: ${taskTitle(t)}`}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return // 내부 버튼(별·링크)의 Enter/Space를 삼키지 않음(AppCard와 동일 가드)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          // onSelect가 없으면(그리드 셀이 클릭을 처리) 네이티브 클릭으로 위임 — Enter/Space = 클릭 동등
          if (onSelect) onSelect()
          else (e.currentTarget as HTMLElement).click()
        }
      }}
      sx={(() => {
        // 상태 대표색 알파 사다리(시안 work-status-color-effects.html): 기본 .055/.24 → 호버 .09/.78+1px 링 → 선택 .15/.92+2px 링
        // 색은 CSS 변수로 해석 — 라이트 전환은 --tone-*/--tone-k가 담당(리렌더 불필요, workMeta 주석 참조)
        const c = toneCss
        const sel = {
          borderColor: toneBorderSelCss,
          bgcolor: toneBody.selected,
          boxShadow: `0 0 0 2px ${toneRingCss}`, /* design-lint-ok(shadow): 0 0 0 = 선택 링(테두리 대용) */
        }
        return {
          '--card-tone': toneVar(tone),
          border: 1,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
          cursor: 'pointer',
          // 메타 줄이 내용 길이와 무관하게 카드 바닥에 붙도록 — 본문(flex:1)이 남는 높이를 흡수
          display: 'flex',
          flexDirection: 'column',
          // 호버에 transform(떠오름)을 쓰지 않는다 — 카드가 움직이면 그 위의 첨부 버튼을 겨냥하기 어렵다
          // (사용자 지적). 호버 피드백은 테두리·배경·그림자만으로.
          transition: 'border-color .16s ease, background-color .16s ease, box-shadow .16s ease',
          // 선택 > 호버 — 선택 시 :hover에도 선택 스타일을 재선언해 유지(.selected:hover에서 호버로 안 돌아감)
          // 첨부 팝업이 열려 있어도 호버는 끄지 않는다 — 팝업을 띄워둔 채 다른 카드를 훑고 고르는
          // 흐름이 막히면 안 된다(사용자 확정). 닫는 클릭만 이 카드 선택에 영향을 안 주게 처리한다.
          ...(selected
            ? {
                ...sel,
                '& .task-head': { bgcolor: c(0.21) },
                '&:hover': { ...sel },
                '&:hover .task-head': { bgcolor: c(0.21) },
              }
            : {
                borderColor: toneBorderCss,
                bgcolor: toneBody.base,
                '& .task-head': { bgcolor: c(0.09) },
                '&:hover': { borderColor: toneBorderHoverCss, bgcolor: toneBody.hover, boxShadow: `0 0 0 1px ${toneRingHoverCss}` /* design-lint-ok(shadow): 0 0 0 = 호버 링(테두리 대용) */ },
                '&:hover .task-head': { bgcolor: c(0.14) },
              }),
          // 키보드 포커스 — 공통 focusRingSx(B#4)로 수렴(상태색과 무관한 표준 링)
          ...(focusRingSx as object),
        }
      })()}
    >
      {/* 머리: 구분 · 제목 · 담당자 · 별 — 배경은 루트 sx의 .task-head 규칙(상태 대표색 사다리)이 결정 */}
      <Box
        className="task-head"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          borderBottom: `1px solid ${toneCss(0.14)}`,
          transition: 'background-color .16s ease',
        }}
      >
        {t.cat && <StatusChip status={catKind(t.cat)} icon={catIcon(t.cat)} label={t.cat} />}
        {/* 새 업무 N 배지 — 진행중+발의 7일(공지 N칩과 동일 디자인). 제목 말줄임과 안 겹치게 flexShrink:0 */}
        {isWorkNew(t) && (
          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: (th) => th.palette.accent.red, color: (th) => th.palette.getContrastText(th.palette.accent.red), fontSize: typescale.micro.size, fontWeight: weight.bold, lineHeight: 1 }}>N</Box>
        )}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: weight.semibold, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        {/* 우측 묶음 — Check · 담당자 · 별을 한 덩어리로. 제목 길이와 무관하게 셋이 오른쪽 끝에 붙는다 */}
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 비공개(개선요청 68) — 남의 화면엔 이 카드 자체가 없으므로, 이 칩은 '나만 보고 있다'는 표시다 */}
          {t.isPrivate && <StatusChip status="neutral" icon={<LockIcon />} label="나만 보기" />}
          {t.chief && <StatusChip status="purple" label="Check" />}
          <ManagerChip name={t.mgr} />
          {/* 관심 업무 별 토글(개인화 D-2) — 계정별 저장, 홈 '관심 업무' 섹션에 고정 표시 */}
          <WorkPinButton num={t.num} />
        </Box>
      </Box>

      {/* 본문 — flex:1로 남는 높이 흡수(메타 줄을 카드 바닥에 고정) */}
      <Box sx={{ flex: 1, px: 1.75, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {subs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {subs.map((l, i) => (
                <SubLine key={i} bodyLine={l} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
          )}
        </Box>
        {/* 메타 줄 — **내용 아래**. 위(제목 바로 밑)로 올려보니 제목과 내용 사이에 턱이 생겨
            매번 부서·날짜를 지나쳐야 본문에 닿았다. 아래에 두면 content가 flex:1이라 이 줄이 카드
            바닥에 붙고, 같은 행 카드끼리 높이가 맞아 줄도 저절로 나란히 선다(사용자 확정 2026-07-26).
            첨부는 별도 푸터 트레이를 두면 구역이 하나 더 생겨 과했다 → 여기 아이콘+건수로 접고 클릭 시 목록. */}
        {/* 링크만 있고 부서·날짜·첨부가 없는 업무도 이 줄이 서야 링크 아이콘의 자리가 유지된다(개선요청 62).
            코멘트 버튼이 생기면서(개선요청 68) 이 줄은 **언제나** 선다 — 조건을 없앤 이유다.
            부서·날짜·첨부·링크가 하나도 없던 업무에는 구분선 한 줄이 새로 생긴다(감수한 대가). */}
        <Box
            sx={{
              display: 'flex', alignItems: 'baseline', flexWrap: 'wrap',
              columnGap: 2, rowGap: 0.75,
              pt: 1.25, borderTop: `1px solid ${toneCss(0.28)}`,
            }}
          >
            {deptMeta && <MetaItem label={deptMeta.label} value={deptMeta.value} />}
            {dateMetas.map((m) => (
              <MetaItem key={m.label} label={m.label} value={m.value} />
            ))}
            {/* 코멘트 · 이력 · 관련링크 · 첨부 — 한 자리에 모아 오른쪽 끝(개선요청 62·66·68). 하나만 있어도 성립한다 */}
            <Box sx={{ ml: 'auto', alignSelf: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {/* 코멘트(개선요청 68) — 건수가 0이어도 버튼은 늘 있다. 없으면 첫 코멘트를 달 길이 없다 */}
              <Box
                component="button"
                type="button"
                aria-label={`코멘트 ${commentCount}건 ${cmtAnchor ? '닫기' : '열기'}`}
                aria-haspopup="dialog"
                aria-expanded={!!cmtAnchor}
                // 같은 버튼 재클릭 = 닫기(토글). el 붙잡기는 첨부 버튼과 같은 이유(아래 주석).
                onClick={(e) => {
                  e.stopPropagation()
                  const el = e.currentTarget
                  onRequestSelect?.()
                  setAttAnchor(null) // 첨부·이력 팝업과 동시에 열리면 겹친다 — 한 번에 하나만
                  setHistAnchor(null)
                  setCmtAnchor((prev) => (prev ? null : el))
                }}
                sx={(th) => ({
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  px: 0.75, py: 0.375, font: 'inherit', cursor: 'pointer',
                  fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight,
                  color: cmtAnchor ? 'text.primary' : 'text.secondary',
                  bgcolor: cmtAnchor ? alpha(th.palette.text.primary, 0.09) : 'transparent',
                  border: 'none', borderRadius: `${radius.chip}px`,
                  transition: `background-color ${motion.base}, color ${motion.base}`,
                  '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.09), color: 'text.primary' },
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
                })}
              >
                <ChatBubbleOutlineIcon sx={{ fontSize: iconSize.action }} />
                {commentCount > 0 && commentCount}
              </Box>
              {/* 이력이 있는 카드에만 시계가 뜬다 — 없는 카드까지 아이콘을 달면 156장이 다 시끄러워진다 */}
              {history.length > 0 && (
                <Box
                  component="button"
                  type="button"
                  aria-label={`변경 이력 ${history.length}건 보기`}
                  aria-haspopup="dialog"
                  aria-expanded={!!histAnchor}
                  onClick={(e) => {
                    e.stopPropagation()
                    const el = e.currentTarget
                    onRequestSelect?.()
                    setAttAnchor(null)
                    setCmtAnchor(null)
                    setHistAnchor((prev) => (prev ? null : el))
                  }}
                  sx={metaBtnSx}
                >
                  <HistoryIcon sx={{ fontSize: iconSize.action }} />
                  {history.length}
                </Box>
              )}
              {/* 호버 미리보기는 TaskLinkButton 안에 있다(개선요청 67) — 아이콘이 옮겨가도 함께 따라온다 */}
              {link && <TaskLinkButton url={link} sx={{ p: 0.5 }} />}
                {atts.length > 0 && (
                  <Box
                    component="button"
                    type="button"
                    aria-label={`첨부파일 ${atts.length}건 보기`}
                    aria-haspopup="dialog"
                    aria-expanded={!!attAnchor}
                    // 같은 버튼 재클릭 = 닫기(토글).
                    // el을 **핸들러 안에서 먼저 붙잡는다** — React는 핸들러가 끝나면 e.currentTarget을 null로
                    // 되돌리는데, setState 갱신함수는 그 뒤에 실행될 수 있어 anchor가 null로 들어갔다.
                    // 그래서 닫은 뒤 다시 눌러도 안 열리고 한 번 더 눌러야 열렸다(사용자 지적).
                    onClick={(e) => {
                      e.stopPropagation()
                      const el = e.currentTarget
                      // 첨부를 눌러도 그 카드가 선택되게(다른 카드가 선택돼 있어도 이 카드로 옮겨온다).
                      // 선택 '전환'이지 토글이 아니라, 이미 선택된 카드에서 다시 눌러도 해제되지 않는다.
                      onRequestSelect?.()
                      setCmtAnchor(null) // 코멘트·이력 팝업과 동시에 열리면 겹친다 — 한 번에 하나만
                      setHistAnchor(null)
                      setAttAnchor((prev) => (prev ? null : el))
                    }}
                    sx={metaBtnSx}
                  >
                    <AttachFileIcon sx={{ fontSize: iconSize.action }} />
                    {atts.length}
                  </Box>
                )}
            </Box>
        </Box>
      </Box>

      {/* 첨부 목록 — 메타 줄의 클립 버튼에서 펼침. 내용은 기존 파일칩 그리드 그대로(다운로드 동작 동일).
          Portal이라 DOM은 카드 밖이지만 React 트리로는 안쪽이라, 카드 선택이 안 걸리게 클릭을 막는다. */}
      {/* Popover(Modal) 대신 Popper + ClickAwayListener — Popover의 백드롭 클릭이 닫히지 않았다
          (Escape는 정상이라 onClose 자체는 살아 있었음). 이 저장소가 이미 쓰는 방식(Calendar 날짜 피커)이라
          동작이 검증돼 있고, 백드롭이 없어 뒤 화면 조작도 막지 않는다.
          stopPropagation은 필수 — Portal이라 DOM은 카드 밖이지만 React 트리로는 안쪽이라
          팝업 클릭이 카드 onClick까지 올라가 카드가 선택돼 버린다. */}
      <Popper open={!!attAnchor} anchorEl={attAnchor} placement="bottom-end" sx={{ zIndex: (th) => th.zIndex.modal }}>
        <ClickAwayListener
          mouseEvent="onMouseDown"
          touchEvent="onTouchStart"
          onClickAway={(e) => {
            // 트리거 버튼 위 클릭은 무시 — 버튼의 토글과 이중으로 처리되면 닫혔다 바로 열린다
            if (attAnchor && e.target instanceof Node && attAnchor.contains(e.target)) return
            setAttAnchor(null)
            swallowNextClickInCard()
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setAttAnchor(null) } }}
            sx={{
              mt: 0.5, p: 1.5, width: { xs: 260, sm: 380 },
              bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
              borderRadius: `${radius.button}px`, boxShadow: shadow.lg,
            }}
          >
            <WorkAttachments attachments={atts} variant="card" />
          </Box>
        </ClickAwayListener>
      </Popper>

      {/* 코멘트 팝업(개선요청 68 — 팝업으로 확정, 사용자 지시 2026-08-13 붉은 네모 = 카드 아래 오른쪽).
          카드 밖에 뜨므로 열어도 격자가 한 픽셀도 안 움직인다.
          닫기 = 말풍선 재클릭(토글) · 카드 클릭 · 바깥 클릭 · Escape — 전부 첨부 팝업과 같은 길.
          카드/바깥 클릭은 ClickAwayListener 가 받고, 그 클릭이 카드 선택을 건드리지 않게 한 번 삼킨다. */}
      <Popper open={!!cmtAnchor} anchorEl={cmtAnchor} placement="bottom-end" sx={{ zIndex: (th) => th.zIndex.modal }}>
        <ClickAwayListener
          mouseEvent="onMouseDown"
          touchEvent="onTouchStart"
          onClickAway={(e) => {
            if (cmtAnchor && e.target instanceof Node && cmtAnchor.contains(e.target)) return
            // 팝업이 띄운 확인창(삭제 ConfirmDialog)은 portal 이라 DOM 상 '바깥'이다 — 그 클릭에
            // 팝업이 닫히면 확인창만 덩그러니 남는다(StickyMemo 의 portal 예외와 같은 이유)
            if (e.target instanceof Element && e.target.closest('.MuiModal-root, .MuiPopper-root')) return
            setCmtAnchor(null)
            swallowNextClickInCard()
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCmtAnchor(null) } }}
            sx={{
              mt: 0.5, width: { xs: 280, sm: 380 },
              // paper 가 아니라 elevated — 카드도 paper 라서 다크에서 팝업이 카드 위에 녹아 안 보였다
              // (사용자 지적 2026-08-13). elevated = '떠 있는 표면' 전용색이라 의미도 이쪽이 맞다.
              bgcolor: 'background.elevated', border: '1px solid', borderColor: 'divider',
              borderRadius: `${radius.button}px`, boxShadow: shadow.lg, overflow: 'hidden',
            }}
          >
            <WorkCardComments num={t.num} />
          </Box>
        </ClickAwayListener>
      </Popper>

      {/* 변경 이력 — 메타 줄의 시계 버튼에서 펼침. 첨부 팝오버와 **완전히 같은 방식**이라
          닫힘·카드 선택 유지 동작이 이미 검증돼 있다(위 주석 참고, 개선요청 66) */}
      <Popper open={!!histAnchor} anchorEl={histAnchor} placement="bottom-end" sx={{ zIndex: (th) => th.zIndex.modal }}>
        <ClickAwayListener
          mouseEvent="onMouseDown"
          touchEvent="onTouchStart"
          onClickAway={(e) => {
            if (histAnchor && e.target instanceof Node && histAnchor.contains(e.target)) return
            setHistAnchor(null)
            swallowNextClickInCard()
          }}
        >
          <Box
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setHistAnchor(null) } }}
            sx={{
              mt: 0.5, p: 1.5, width: { xs: 280, sm: 420 },
              bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
              borderRadius: `${radius.button}px`, boxShadow: shadow.lg,
            }}
          >
            <WorkHistoryList rows={history} />
          </Box>
        </ClickAwayListener>
      </Popper>
    </Box>
  )
}
