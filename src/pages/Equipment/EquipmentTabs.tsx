import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'

// 장비관리 상단 탭 — 장비도입(/equipment) · 장비운영(/equipment-ops) 전환. (업무일정 뷰탭과 동일 톤)
const TABS = [
  { label: '장비도입', path: '/equipment' },
  { label: '장비운영', path: '/equipment-ops' },
]

export default function EquipmentTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <Box sx={{ display: 'inline-flex', gap: '3px', bgcolor: 'background.elevated', p: '3px', borderRadius: '9px', mb: 2 }}>
      {TABS.map((t) => {
        const active = pathname === t.path
        return (
          <Box
            key={t.path}
            component="button"
            onClick={() => navigate(t.path)}
            sx={{
              px: '18px', py: '6px', borderRadius: '7px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
              fontWeight: active ? 700 : 600,
              color: active ? 'primary.main' : 'text.secondary',
              bgcolor: active ? 'background.paper' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,.35)' : 'none',
              transition: 'all .12s',
            }}
          >
            {t.label}
          </Box>
        )
      })}
    </Box>
  )
}
