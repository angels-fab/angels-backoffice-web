import type { ReactElement } from 'react'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'

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
        <Box
          component="span"
          sx={{ px: '7px', py: '3px', borderRadius: 999, fontSize: 10, fontWeight: 800, color: d.catColor, bgcolor: alpha(d.catColor, 0.22) }}
        >
          {d.catLabel}
        </Box>
        {d.time && (
          <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>
            {d.time}
          </Box>
        )}
      </Box>
      <Box sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.45, color: '#fff', mb: 1 }}>{d.purpose}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.25, rowGap: '4px', fontSize: 11, lineHeight: 1.5 }}>
        <Box sx={{ color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>장소</Box>
        <Box sx={{ color: 'rgba(255,255,255,.88)' }}>{d.place || '미지정'}</Box>
        <Box sx={{ color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>해당자</Box>
        <Box sx={{ color: 'rgba(255,255,255,.88)' }}>{d.members.length ? d.members.join(' · ') : '미지정'}</Box>
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
            bgcolor: '#151e2c',
            border: '1px solid #3a485d',
            p: 1.25,
            borderRadius: '10px',
            boxShadow: '0 12px 34px rgba(0,0,0,.42)',
          },
        },
        arrow: { sx: { color: '#151e2c', '&::before': { border: '1px solid #3a485d' } } },
      }}
    >
      {children}
    </Tooltip>
  )
}
