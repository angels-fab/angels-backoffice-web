import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { mergeSx } from '@/components/ds/sxMerge'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { StatusChip, focusRingSx } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import { isWorkNew } from '@/utils/newPost'
import type { WorkItem } from '@/types'
import { taskTitle, taskLink, catKind, toneVar, toneCss } from './workMeta'
import ManagerChip from '@/components/ds/ManagerChip'
import type { CardTone } from './workMeta'
import { workBodyLines } from './richContent'
import SubLine from './SubLine'
import WorkPinButton from './WorkPinButton'
import WorkAttachments from './WorkAttachments'

export type { CardTone } from './workMeta'

export interface TaskAccordionProps {
  t: WorkItem
  /** 카드 상태 계층 색 — 업무 상태의 KPI 대표색(D3: 진행중 그린·보류 앰버·완료 블루·Remind 퍼플) */
  tone: CardTone
  /** 선택 여부 — 같은 대표색의 강한 테두리·배경·링(호버보다 우선) */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
}

/**
 * 업무 카드 — 아코디언 없이 항상 내용 표시(정적).
 * 머리 1행: 구분칩 · 제목 · 담당자칩 · 별 / 머리 2행: 부서(좌) · 발의·예정·완료(우측 고정)
 * 본문: 내용 불릿 · 관련링크 / 푸터: 첨부 트레이.
 * (완료·수정·삭제는 더보기 메뉴 대신 드래그 상태변경·더블클릭 수정·휴지통 드롭으로 수행)
 */
/** 머리 2행의 라벨+값 한 쌍 — 라벨은 부차(11px 보조톤), 값은 부수(13px 주톤) */
function MetaItem({ label, value, sx }: { label: string; value: string; sx?: SxProps<Theme> }) {
  return (
    <Typography variant="caption" sx={mergeSx({ color: 'text.secondary', whiteSpace: 'nowrap' }, sx)}>
      {label} <Box component="span" sx={{ color: 'text.primary', fontSize: typescale.body.size }}>{value}</Box>
    </Typography>
  )
}

export default function TaskAccordion({ t, tone, selected = false, onSelect }: TaskAccordionProps) {
  const subs = workBodyLines(t)
  const link = taskLink(t)
  // 부서·날짜는 제목줄 칩에서 **머리 2행**으로 옮겼다(다안, 사용자 확정 2026-07-26).
  // 칩이 4개면 글자 처리가 3가지로 갈려 시끄러웠고, 부서·날짜는 "걸러낼 분류"가 아니라 그냥 값이라
  // 칩이라는 그릇이 맞지 않았다. 머리(무엇인지) ↔ 본문(무슨 내용인지)을 농도 계단으로 가른다.
  // 부서는 왼쪽, 날짜는 오른쪽 끝 고정 — 카드를 세로로 훑을 때 날짜가 한 줄로 서야 비교가 된다.
  const deptMeta = (t.dept || '').trim() ? { label: '부서', value: t.dept as string } : null
  const dateMetas: { label: string; value: string }[] = [
    { label: '발의', value: t.start ? fmtDate(t.start) : '' },
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())
  const hasMeta = !!deptMeta || dateMetas.length > 0

  return (
    <Box
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
          borderColor: c(0.92),
          bgcolor: c(0.15),
          boxShadow: `0 0 0 2px ${c(0.22)}, 0 10px 26px rgba(0,0,0,.2)`,
        }
        return {
          '--card-tone': toneVar(tone),
          border: 1,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
          cursor: 'pointer',
          // 푸터 트레이(첨부)가 늘어난 카드에서도 바닥에 붙도록 — 본문(flex:1)이 남는 높이를 흡수
          display: 'flex',
          flexDirection: 'column',
          // 호버 시 2px 떠오름 — 그림자와 함께 움직여야 "떴다"로 읽힌다(transform만 주면 그냥 어긋나 보임)
          transition: 'border-color .16s ease, background-color .16s ease, box-shadow .16s ease, transform .16s ease',
          // 선택 > 호버 — 선택 시 :hover에도 선택 스타일을 재선언해 유지(.selected:hover에서 호버로 안 돌아감)
          // 머리는 농도 계단 2단 — 제목행(짙게) > 메타행(한 단 아래) > 본문(카드 배경).
          // 계단만으로 층이 읽히므로 두 행 사이 구분선은 긋지 않는다(선을 덜 그을수록 카드가 조용하다).
          ...(selected
            ? {
                ...sel,
                '& .task-head': { bgcolor: c(0.21) },
                '& .task-meta': { bgcolor: c(0.175) },
                '&:hover': { ...sel, transform: 'translateY(-2px)', boxShadow: `0 0 0 2px ${c(0.22)}, var(--shadow-lg)` },
                '&:hover .task-head': { bgcolor: c(0.21) },
              }
            : {
                borderColor: c(0.24),
                bgcolor: c(0.055),
                '& .task-head': { bgcolor: c(0.09) },
                '& .task-meta': { bgcolor: c(0.075) },
                '&:hover': { borderColor: c(0.78), bgcolor: c(0.09), transform: 'translateY(-2px)', boxShadow: `0 0 0 1px ${c(0.14)}, var(--shadow-md)` },
                '&:hover .task-head': { bgcolor: c(0.14) },
                '&:hover .task-meta': { bgcolor: c(0.115) },
              }),
          // 키보드 포커스 — 공통 focusRingSx(B#4)로 수렴(상태색과 무관한 표준 링)
          ...(focusRingSx as object),
        }
      })()}
    >
      {/* 머리 1행: 구분 · 제목 · 담당자 — 배경은 루트 sx의 .task-head 규칙(상태 대표색 사다리)이 결정.
          아래 경계선은 머리 블록의 마지막 행이 진다(메타행이 있으면 그쪽으로 넘김). */}
      <Box
        className="task-head"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          ...(hasMeta ? null : { borderBottom: `1px solid ${toneCss(0.14)}` }),
          transition: 'background-color .16s ease',
        }}
      >
        {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
        {/* 새 업무 N 배지 — 진행중+발의 7일(공지 N칩과 동일 디자인). 제목 말줄임과 안 겹치게 flexShrink:0 */}
        {isWorkNew(t) && (
          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: (th) => th.palette.accent.red, color: (th) => th.palette.getContrastText(th.palette.accent.red), fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
        )}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        <ManagerChip name={t.mgr} />
        {/* 관심 업무 별 토글(개인화 D-2) — 계정별 저장, 홈 '관심 업무' 섹션에 고정 표시 */}
        <WorkPinButton num={t.num} />
      </Box>

      {/* 머리 2행: 부서(좌) · 날짜(우측 고정). 제목행보다 한 단 옅어 본문으로 자연스럽게 이어진다 */}
      {hasMeta && (
        <Box
          className="task-meta"
          sx={{
            display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap',
            px: 1.75, py: 0.875,
            borderBottom: `1px solid ${toneCss(0.14)}`,
            transition: 'background-color .16s ease',
          }}
        >
          {deptMeta && <MetaItem label={deptMeta.label} value={deptMeta.value} />}
          {dateMetas.map((m, i) => (
            <MetaItem key={m.label} label={m.label} value={m.value} sx={i === 0 ? { ml: 'auto' } : undefined} />
          ))}
        </Box>
      )}

      {/* 본문 — flex:1로 남는 높이 흡수(푸터 트레이를 카드 바닥에 고정) */}
      <Box sx={{ flex: 1, px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
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
          {link && (
            <Box sx={{ mt: 0.25 }}>
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
              </IconButton>
            </Box>
          )}
        </Box>
        {t.chief && (
          <Box
            sx={(th) => ({
              width: 84, height: 84, flexShrink: 0, alignSelf: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 1, borderColor: alpha(th.palette.accent.purple, 0.55), bgcolor: alpha(th.palette.accent.purple, 0.16),
              borderRadius: `${radius.modal}px`,
              color: th.palette.accentText.purple, fontWeight: 800, fontSize: typescale.emphasis.size,
            })}
          >
            Check
          </Box>
        )}
      </Box>

      {/* 첨부 푸터 트레이(시안 A) — 풀와이드, 살짝 가라앉은 배경으로 본문과 구역 분리 */}
      {t.attachments && t.attachments.length > 0 && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={(th) => ({
            borderTop: `1px solid ${toneCss(0.14)}`,
            bgcolor: alpha(th.palette.common.black, th.palette.mode === 'dark' ? 0.16 : 0.04),
            px: 1.75, pt: 1.25, pb: 1.5,
          })}
        >
          <WorkAttachments attachments={t.attachments} variant="card" />
        </Box>
      )}
    </Box>
  )
}
