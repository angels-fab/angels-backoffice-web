import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { alpha } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import { isWorkNew } from '@/utils/newPost'
import type { WorkItem } from '@/types'
import { taskTitle, taskLink, mgrColor, catKind, deptKind, TONE_RGB } from './workMeta'
import type { CardTone } from './workMeta'
import { workBodyLines } from './richContent'
import SubLine from './SubLine'

export type { CardTone } from './workMeta'

export interface TaskAccordionProps {
  t: WorkItem
  /** 카드 상태 계층 색 — 업무 상태의 KPI 대표색(진행중 초록·보류 파랑·완료 회색·Remind 앰버) */
  tone: CardTone
  /** 선택 여부 — 같은 대표색의 강한 테두리·배경·링(호버보다 우선) */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
}

/**
 * 업무 카드 — 아코디언 없이 항상 내용 표시(정적).
 * 제목 줄: 구분칩 · 관련부서칩 · 제목 · 담당자칩 · 발의일자칩.
 * (완료·수정·삭제는 더보기 메뉴 대신 드래그 상태변경·더블클릭 수정·휴지통 드롭으로 수행)
 */
export default function TaskAccordion({ t, tone, selected = false, onSelect }: TaskAccordionProps) {
  const subs = workBodyLines(t)
  const link = taskLink(t)
  // 부서는 제목줄 칩으로 이동 — 본문 메타는 예정/완료만
  const metas: { label: string; value: string }[] = [
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`업무: ${taskTitle(t)}`}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      sx={() => {
        // 상태 대표색 알파 사다리(시안 work-status-color-effects.html): 기본 .055/.24 → 호버 .09/.78+1px 링 → 선택 .15/.92+2px 링
        const c = (a: number) => `rgb(${TONE_RGB[tone]} / ${a})`
        const sel = {
          borderColor: c(0.92),
          bgcolor: c(0.15),
          boxShadow: `0 0 0 2px ${c(0.22)}, 0 10px 26px rgba(0,0,0,.2)`,
        }
        return {
          border: 1,
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color .16s ease, background-color .16s ease, box-shadow .16s ease',
          // 선택 > 호버 — 선택 시 :hover에도 선택 스타일을 재선언해 유지(.selected:hover에서 호버로 안 돌아감)
          ...(selected
            ? {
                ...sel,
                '& .task-head': { bgcolor: c(0.21), borderBottomColor: c(0.14) },
                '&:hover': sel,
                '&:hover .task-head': { bgcolor: c(0.21) },
              }
            : {
                borderColor: c(0.24),
                bgcolor: c(0.055),
                '& .task-head': { bgcolor: c(0.09), borderBottomColor: c(0.14) },
                '&:hover': { borderColor: c(0.78), bgcolor: c(0.09), boxShadow: `0 0 0 1px ${c(0.14)}` },
                '&:hover .task-head': { bgcolor: c(0.14) },
              }),
          // 키보드 포커스 — 선택 상태와 충돌하지 않는 별도 접근성 outline(상태색과 무관한 파랑)
          '&:focus-visible': { outline: '2px solid #7db3ef', outlineOffset: '1px' },
        }
      }}
    >
      {/* 제목 줄 (③ 띠 채움) — 배경·경계색은 루트 sx의 .task-head 규칙(상태 대표색 사다리)이 결정 */}
      <Box
        className="task-head"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          borderBottom: '1px solid transparent',
          transition: 'background-color .16s ease',
        }}
      >
        {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
        {t.dept && <StatusChip status={deptKind(t.dept)} label={t.dept} />}
        {/* 새 업무 N 배지 — 진행중+발의 7일(공지 N칩과 동일 디자인). 제목 말줄임과 안 겹치게 flexShrink:0 */}
        {isWorkNew(t) && (
          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: '4px', bgcolor: 'error.main', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
        )}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 24, boxSizing: 'border-box', fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1.25, bgcolor: mgrColor(t.mgr), color: '#fff', whiteSpace: 'nowrap' }}>
          {t.mgr || '미지정'}
        </Box>
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', height: 24, boxSizing: 'border-box', fontSize: 12, borderRadius: '8px', px: 1, color: 'text.secondary', bgcolor: alpha(th.palette.text.secondary, 0.14), border: 1, borderColor: alpha(th.palette.text.secondary, 0.3), fontFamily: 'monospace', whiteSpace: 'nowrap' })}>
          {fmtDate(t.start)}
        </Box>
      </Box>

      {/* 본문 */}
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {metas.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {metas.map((m) => (
                <Typography key={m.label} variant="caption" sx={{ color: 'text.secondary' }}>
                  {m.label} <Box component="span" sx={{ color: 'text.primary' }}>{m.value}</Box>
                </Typography>
              ))}
            </Box>
          )}
          {subs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {subs.map((l, i) => (
                <SubLine key={i} bodyLine={l} />
              ))}
            </Box>
          ) : (
            metas.length === 0 && <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
          )}
          {link && (
            <Box sx={{ mt: 0.25 }}>
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
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
              borderRadius: '14px',
              color: th.palette.accent.purple, fontWeight: 800, fontSize: 15,
            })}
          >
            Check
          </Box>
        )}
      </Box>
    </Box>
  )
}
