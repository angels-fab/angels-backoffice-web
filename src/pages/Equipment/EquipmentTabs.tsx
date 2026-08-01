import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { radius, typescale } from '@/theme/tokens'

// 장비관리 상단 탭 — 장비도입(/equipment) · 장비운영(/equipment-ops) 전환.
// 세그먼트(SegTabs)에서 **밑줄형 상위 탭**으로 승격: 이 둘은 '보기 전환'이 아니라 서로 다른 화면(라우트)이라
// 목록/월/주 같은 뷰 토글과 같은 모양이면 위계가 어긋난다. NOL·티켓링크류 1차 내비와 같은 관행.
const TABS = [
  { value: '/equipment', label: '장비도입' },
  { value: '/equipment-ops', label: '장비운영' },
] as const

export default function EquipmentTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname === '/equipment-ops' ? '/equipment-ops' : '/equipment'
  return (
    <Box
      role="tablist"
      aria-label="장비 도입/운영 전환"
      sx={{ display: 'flex', gap: 3, borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}
    >
      {TABS.map((t) => {
        const on = t.value === active
        return (
          <Box
            key={t.value}
            component="button"
            role="tab"
            aria-selected={on}
            onClick={() => navigate(t.value)}
            sx={{
              position: 'relative',
              px: 0.5, pt: 0.5, pb: '10px',
              border: 'none', bgcolor: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              fontSize: typescale.cardTitle.size,
              fontWeight: on ? typescale.cardTitle.weight : typescale.emphasis.weight,
              color: on ? 'text.primary' : 'text.secondary',
              transition: 'color .14s',
              '&:hover': { color: 'text.primary' },
              // 활성 밑줄 — 컨테이너의 1px 경계선 위에 2px로 얹힌다
              '&::after': {
                content: '""', position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '2px',
                bgcolor: 'primary.main', borderRadius: `${radius.pill}px ${radius.pill}px 0 0`,
                opacity: on ? 1 : 0, transition: 'opacity .14s',
              },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px', borderRadius: '4px' },
            }}
          >
            {t.label}
          </Box>
        )
      })}
    </Box>
  )
}
