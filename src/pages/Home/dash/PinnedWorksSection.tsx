import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, StatusChip } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { taskTitle, catKind, mgrColor, classify, W_STATUS } from '@/pages/Work/workMeta'
import WorkPinButton from '@/pages/Work/WorkPinButton'

/** 홈 '관심 업무' 데이터 훅 — 핀(num) 순서대로 실제 업무 매칭(삭제·미존재는 자동 제외) */
export function usePinnedWorks() {
  const items = useAppSelector((s) => s.work.items)
  const pins = useAppSelector((s) => s.userSettings.settings['work.pins'])
  const list = Array.isArray(pins) ? pins.map(String) : []
  return list.map((num) => items.find((t) => t.num === num)).filter((t): t is NonNullable<typeof t> => !!t)
}

/**
 * 관심 업무 섹션(개인화 D-2) — 내가 별(★)로 고정한 업무를 홈에서 바로 확인.
 * 행 = [별 해제] 구분칩 · 업무명 · 담당자칩 · 상태칩, 클릭 시 업무현황으로 이동.
 * 핀이 없으면 섹션 자체를 렌더하지 않음(Home에서 게이트).
 */
export default function PinnedWorksSection() {
  const navigate = useNavigate()
  const works = usePinnedWorks()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {works.map((t) => {
        const st = W_STATUS[classify(t)]
        return (
          <AppCard key={t.num} interactive padding={10} onClick={() => navigate('/work')}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <WorkPinButton num={t.num} />
              {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {taskTitle(t)}
              </Typography>
              <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 22, fontSize: 12, fontWeight: 700, borderRadius: '8px', px: 1, bgcolor: mgrColor(t.mgr), color: '#fff', whiteSpace: 'nowrap' }}>
                {t.mgr || '미지정'}
              </Box>
              <Box sx={{ flexShrink: 0 }}>
                <StatusChip status={st.status} label={st.label} />
              </Box>
            </Box>
          </AppCard>
        )
      })}
    </Box>
  )
}
