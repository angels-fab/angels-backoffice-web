import type { ReactElement } from 'react'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { radius, shadow, typescale, weight } from '../../theme/tokens'
import { catTextColor, toneOfColor } from './catMeta'

/** 일정 칩 호버 상세 — 목적을 제목으로, 장소를 세부정보로 분리해 보여준다. */
export interface EventDetail {
  catLabel: string
  catColor: string
  time?: string
  purpose: string
  place: string
  members: string[]
}

function DetailBody({ d }: { d: EventDetail }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.9 }}>
        {/* 글자는 catTextColor(글자용 짝) — 채움색을 그대로 쓰면 자기 틴트 위에서 대비가 무너진다 */}
        <Box
          component="span"
          sx={(th) => ({ px: '7px', py: '3px', borderRadius: `${radius.pill}px`, fontSize: typescale.caption.size, fontWeight: weight.heavy, color: catTextColor(th, toneOfColor(d.catColor)), bgcolor: alpha(d.catColor, 0.22) })}
        >
          {d.catLabel}
        </Box>
        {d.time && (
          <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {d.time}
          </Box>
        )}
      </Box>
      <Box sx={{ fontSize: typescale.body.size, fontWeight: weight.bold, lineHeight: 1.45, color: 'text.primary', mb: 1 }}>{d.purpose}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.25, rowGap: '4px', fontSize: typescale.caption.size, lineHeight: 1.5 }}>
        <Box sx={{ color: 'text.disabled', fontWeight: weight.semibold }}>장소</Box>
        <Box sx={{ color: 'text.primary' }}>{d.place || '미지정'}</Box>
        <Box sx={{ color: 'text.disabled', fontWeight: weight.semibold }}>해당자</Box>
        <Box sx={{ color: 'text.primary' }}>{d.members.length ? d.members.join(' · ') : '미지정'}</Box>
      </Box>
    </Box>
  )
}

export default function ChipTooltip({ detail, children }: { detail: EventDetail; children: ReactElement }) {
  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={150}
      leaveDelay={0}
      title={<DetailBody d={detail} />}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 290,
            // 툴팁 표면을 카드색으로 덮으므로 글자색도 반드시 짝으로 되돌린다.
            // (테마 기본 툴팁은 어두운 표면 + 흰 글자라, 배경만 흰색으로 덮으면 흰 글씨가 남는다)
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            p: 1.25,
            borderRadius: `${radius.button}px`,
            boxShadow: shadow.md,
          },
        },
        arrow: { sx: { color: 'background.paper', '&::before': { border: '1px solid', borderColor: 'divider' } } },
      }}
    >
      {children}
    </Tooltip>
  )
}
