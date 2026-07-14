import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import TuneIcon from '@mui/icons-material/Tune'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { PageContainer, PageHeader, ContentSection } from '@/components/ds'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'
import RoadmapCard from './RoadmapCard'
import KpiOverview from './dash/KpiOverview'
import ScheduleSection from './dash/ScheduleSection'
import WorkStatusSection from './dash/WorkStatusSection'
import EquipmentSection from './dash/EquipmentSection'
import NoticeSection from './dash/NoticeSection'
import PinnedWorksSection, { usePinnedWorks } from './dash/PinnedWorksSection'

/**
 * 홈 = 연구센터 운영 대시보드(STEP4) + 섹션 개인화(개인화 D-1/D-2).
 *
 * 기본 위계: ① KPI → ② 일정 → (관심 업무) → ③ 업무 현황 → ④ 장비 현황 → ⑤ 공지.
 * 팀원 대시보드 섹션은 계정별로 순서 변경·숨김 가능(user_settings `home.order`/`home.hidden`).
 * FAB 로드맵은 게스트 공개 + 디자인 규칙(로드맵 최우선·크게)상 개인화 대상에서 제외 — 항상 최상단 고정.
 */

const SECTION_IDS = ['kpi', 'schedule', 'pins', 'work', 'equipment', 'notice'] as const
type SectionId = (typeof SECTION_IDS)[number]
const SECTION_LABEL: Record<SectionId, string> = {
  kpi: '운영 KPI',
  schedule: '오늘·다가오는 일정',
  pins: '관심 업무',
  work: '업무 현황',
  equipment: '장비 현황',
  notice: '공지사항',
}
const DEFAULT_ORDER: SectionId[] = ['kpi', 'schedule', 'pins', 'work', 'equipment', 'notice']
const isSectionId = (v: unknown): v is SectionId => typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v)

export default function Home() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isMember } = useRole()
  // 홈 배치 개인화 — 저장 순서(모르는 id 무시 + 누락 id는 기본 순서로 뒤에 병합)와 숨김 집합.
  // 저장/편집 UI는 설정 로드 '성공'(loadedOk) 세션에서만(서버 상태 모르고 덮어쓰기 방지 — 필터와 동일 기준).
  const usLoadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const svOrder = useAppSelector((s) => s.userSettings.settings['home.order'])
  const svHidden = useAppSelector((s) => s.userSettings.settings['home.hidden'])
  const pinnedWorks = usePinnedWorks()
  const order = useMemo<SectionId[]>(() => {
    const saved = Array.isArray(svOrder) ? svOrder.filter(isSectionId) : []
    const seen = new Set(saved)
    return [...saved, ...DEFAULT_ORDER.filter((id) => !seen.has(id))]
  }, [svOrder])
  const hidden = useMemo(
    () => new Set((Array.isArray(svHidden) ? svHidden.filter(isSectionId) : []) as SectionId[]),
    [svHidden],
  )
  // 관심 업무는 핀이 있을 때만 렌더(빈 섹션 방지 — 편집 목록에는 항상 노출해 존재를 알림)
  const visible = order.filter((id) => !hidden.has(id) && (id !== 'pins' || pinnedWorks.length > 0))

  const [cfgAnchor, setCfgAnchor] = useState<HTMLElement | null>(null)
  const move = (id: SectionId, dir: -1 | 1) => {
    const i = order.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= order.length) return
    const next = [...order]
    next[i] = next[j]
    next[j] = id
    dispatch(putSetting({ key: 'home.order', value: next }))
  }
  const toggleHide = (id: SectionId) => {
    const next = hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id]
    dispatch(putSetting({ key: 'home.hidden', value: next }))
  }
  const resetLayout = () => {
    dispatch(putSetting({ key: 'home.order', value: DEFAULT_ORDER }))
    dispatch(putSetting({ key: 'home.hidden', value: [] }))
  }

  const moreBtn = (to: string) => (
    <Button variant="text" size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate(to)} sx={{ color: 'text.secondary' }}>
      전체보기
    </Button>
  )

  const sectionNode: Record<SectionId, ReactNode> = {
    kpi: <KpiOverview />,
    schedule: <ScheduleSection />,
    pins: <PinnedWorksSection />,
    work: <WorkStatusSection />,
    equipment: <EquipmentSection />,
    notice: <NoticeSection />,
  }
  const sectionMeta: Record<SectionId, { title?: string; to?: string }> = {
    kpi: {},
    schedule: {},
    pins: { title: '관심 업무', to: '/work' },
    work: { title: '업무 현황', to: '/work' },
    equipment: { title: '장비 현황', to: '/equipment' },
    notice: { title: '공지사항', to: '/notice' },
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<SpaceDashboardIcon />}
        title="운영 대시보드"
        actions={isMember && usLoadedOk ? (
          <Tooltip title="홈 구성 편집 (나에게만 적용)">
            <IconButton aria-label="홈 구성 편집" onClick={(e) => setCfgAnchor(e.currentTarget)} sx={{ color: 'text.secondary' }}>
              <TuneIcon sx={{ fontSize: iconSize.header }} />
            </IconButton>
          </Tooltip>
        ) : undefined}
      />

      {/* 홈 구성 편집 — 섹션 순서(위/아래)·표시 토글. 계정별 저장(user_settings) */}
      <Popover
        open={!!cfgAnchor}
        anchorEl={cfgAnchor}
        onClose={() => setCfgAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 1.25, width: 280 } } }}
      >
        <Typography variant="caption" sx={{ display: 'block', px: 0.75, pb: 0.75, color: 'text.disabled' }}>
          섹션 순서·표시 — 나에게만 적용
        </Typography>
        {order.map((id, i) => {
          const off = hidden.has(id)
          return (
            <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.4, borderRadius: `${radius.card}px`, '&:hover': { bgcolor: 'action.hover' } }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: typescale.emphasis.weight, color: off ? 'text.disabled' : 'text.primary' }}>
                {SECTION_LABEL[id]}
                {id === 'pins' && pinnedWorks.length === 0 && (
                  <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.5 }}>
                    (고정한 업무 없음)
                  </Typography>
                )}
              </Typography>
              <IconButton size="small" aria-label={`${SECTION_LABEL[id]} 위로`} disabled={i === 0} onClick={() => move(id, -1)}>
                <ArrowUpwardIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
              <IconButton size="small" aria-label={`${SECTION_LABEL[id]} 아래로`} disabled={i === order.length - 1} onClick={() => move(id, 1)}>
                <ArrowDownwardIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
              <IconButton size="small" aria-label={off ? `${SECTION_LABEL[id]} 표시` : `${SECTION_LABEL[id]} 숨김`} onClick={() => toggleHide(id)} sx={{ color: off ? 'text.disabled' : 'primary.main' }}>
                {off ? <VisibilityOffOutlinedIcon sx={{ fontSize: iconSize.action }} /> : <VisibilityOutlinedIcon sx={{ fontSize: iconSize.action }} />}
              </IconButton>
            </Box>
          )
        })}
        <Divider sx={{ my: 0.75 }} />
        <Button size="small" startIcon={<RestartAltIcon sx={{ fontSize: iconSize.body }} />} onClick={resetLayout} sx={{ color: 'text.secondary' }}>
          기본 배치로
        </Button>
      </Popover>

      {/* FAB 구축 로드맵 — 전체 공개 · 항상 최상단(개인화 제외). 소제목은 카드 자체 제목과 중복이라 생략,
          범례·단계 상태칩은 노드 색으로 충분해 제거(사용자 요청) */}
      <ContentSection last={!isMember || visible.length === 0}>
        <RoadmapCard showLegend={false} showBadges={false} />
      </ContentSection>

      {/* 팀원(이상) 대시보드 — 계정별 순서·숨김 적용 */}
      {isMember && visible.map((id, i) => (
        <ContentSection
          key={id}
          title={sectionMeta[id].title}
          action={sectionMeta[id].to ? moreBtn(sectionMeta[id].to as string) : undefined}
          last={i === visible.length - 1}
        >
          {sectionNode[id]}
        </ContentSection>
      ))}
    </PageContainer>
  )
}
