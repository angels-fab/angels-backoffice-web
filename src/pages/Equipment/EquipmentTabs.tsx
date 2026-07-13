import { useLocation, useNavigate } from 'react-router-dom'
import { SegTabs } from '@/components/ds'

// 장비관리 상단 탭 — 장비도입(/equipment) · 장비운영(/equipment-ops) 전환. 공용 SegTabs.
const TABS = [
  { value: '/equipment', label: '장비도입' },
  { value: '/equipment-ops', label: '장비운영' },
] as const

export default function EquipmentTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname === '/equipment-ops' ? '/equipment-ops' : '/equipment'
  return (
    <SegTabs
      ariaLabel="장비 도입/운영 전환"
      items={TABS}
      value={active}
      onChange={(v) => navigate(v)}
      sx={{ mb: 2 }}
    />
  )
}
