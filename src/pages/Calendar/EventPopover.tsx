import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { accent, radius, shadow } from '../../theme/tokens'

/** 일정 상세 데이터 — 원본 제목 그대로(장소-목적 분리 안 함) + 시간 + 전체 해당자 + 분류. */
export interface EventDetail {
  catLabel: string
  catColor: string
  time?: string
  /** 작성된 원본 제목([구분]·@참석자만 제거, 본문은 그대로) */
  title: string
  /** 전체 해당자(이름) */
  members: string[]
}

interface Props {
  detail: EventDetail
  /** 상호작용한 마우스 위치(viewport 좌표) */
  x: number
  y: number
  /** 클릭으로 고정된 상태 — true면 포인터 이벤트 받음, false(호버)면 포인터 통과(hover 깜빡임 방지) */
  locked?: boolean
  /** 수정 진입(관리자·고정 상태에서만 버튼 노출) — 부모가 작성 모달을 연다 */
  onEdit?: () => void
}

/**
 * 호버·클릭 상세 — 마우스 위치 기준으로 띄우고 뷰포트 경계에서 위치를 자동 보정한다.
 * (멀티데이 막대 중앙이 아니라 사용자가 가리킨/클릭한 지점 근처에 표시)
 * 호버 상태에서는 pointer-events:none 으로 포인터를 가리지 않아 hover가 반복 해제되지 않는다.
 * 닫기는 부모가 담당(호버 leave / 바깥 클릭 / Esc / 같은 일정 재클릭).
 */
export default function EventPopover({ detail, x, y, locked, onEdit }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number; ready: boolean }>({ left: x + 14, top: y + 16, ready: false })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const m = 10
    let left = x + 14 // 포인터 오른쪽으로 살짝 띄움
    let top = y + 16
    if (left + r.width > window.innerWidth - m) left = x - r.width - 14 // 오른쪽 공간 부족 → 포인터 왼쪽
    if (left < m) left = m
    if (left + r.width > window.innerWidth - m) left = window.innerWidth - m - r.width
    if (top + r.height > window.innerHeight - m) top = y - r.height - 12 // 아래 공간 부족 → 위로 뒤집기
    if (top < m) top = m
    setPos({ left, top, ready: true })
  }, [x, y, detail])

  return (
    <Box
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="일정 상세"
      sx={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 10000, // FullCalendar '+N건' more-link 팝오버(z-index 9999) 위에 떠야 함
        pointerEvents: locked ? 'auto' : 'none',
        width: 300,
        maxWidth: 'calc(100vw - 20px)',
        visibility: pos.ready ? 'visible' : 'hidden',
        bgcolor: '#151e2c',
        border: '1px solid #3a485d',
        borderRadius: radius.button,
        p: 1.5,
        color: 'common.white',
        boxShadow: shadow.md,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box component="span" sx={{ px: '8px', py: '3px', borderRadius: radius.pill, fontSize: 11, fontWeight: 800, color: detail.catColor, bgcolor: alpha(detail.catColor, 0.22) }}>
          {detail.catLabel}
        </Box>
        {detail.time && (
          <Box component="span" sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>
            {detail.time}
          </Box>
        )}
      </Box>
      <Box sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {detail.title}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.25, rowGap: '4px', fontSize: 12, lineHeight: 1.5 }}>
        <Box sx={{ color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>해당자</Box>
        <Box sx={{ color: 'rgba(255,255,255,.9)' }}>{detail.members.length ? detail.members.join(' · ') : '센터'}</Box>
      </Box>
      {locked && onEdit && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
          <Box
            component="button"
            type="button"
            onClick={onEdit}
            sx={{
              font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              px: 1.25, py: '5px', borderRadius: radius.chip,
              color: '#9ec4f2', bgcolor: alpha(accent.blue, 0.14), border: `1px solid ${alpha(accent.blue, 0.4)}`,
              '&:hover': { bgcolor: alpha(accent.blue, 0.24) },
            }}
          >
            수정
          </Box>
        </Box>
      )}
    </Box>
  )
}
