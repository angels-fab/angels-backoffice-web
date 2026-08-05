import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
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
import ScheduleSection from './dash/ScheduleSection'
import HomeKpi from './dash/HomeKpi'
import WorkMixCard from './dash/WorkMixCard'
import WorkStatusSection from './dash/WorkStatusSection'
import StatusSummary from './dash/StatusSummary'
import NoticeSection from './dash/NoticeSection'
import PinnedWorksSection, { usePinnedWorks } from './dash/PinnedWorksSection'

/**
 * 홈 = 연구센터 운영 대시보드(STEP4) + 섹션 개인화(개인화 D-1/D-2).
 *
 * 기본 위계: ① KPI → ② 일정 → (관심 업무) → ③ 업무 현황 → ④ 장비 현황 → ⑤ 공지.
 * 구성원 대시보드 섹션은 계정별로 순서 변경·숨김 가능(user_settings — 아래 ORDER_KEY/HIDDEN_KEY).
 * FAB 로드맵은 게스트 공개 + 디자인 규칙(로드맵 최우선·크게)상 개인화 대상에서 제외 — 항상 최상단 고정.
 */

/**
 * 섹션 목록 (2026-08-05 개편).
 * 없앤 것: `kpi`(6타일 — 진행중 업무·오늘 일정·신규 공지가 아래 섹션과 그대로 중복이었고
 * 나머지는 2027년까지 안 바뀌는 값), `equipment`(현황 줄로 흡수).
 * 저장된 순서에 옛 id가 남아 있어도 isSectionId 가 걸러내므로 마이그레이션은 필요 없다.
 */
const SECTION_IDS = ['kpi', 'today', 'mix', 'work', 'notice', 'pins', 'status'] as const
type SectionId = (typeof SECTION_IDS)[number]
const SECTION_LABEL: Record<SectionId, string> = {
  kpi: '안 본 새 글',
  today: '오늘 일정 · 달력',
  mix: '업무 구성',
  work: '진행 중 업무',
  notice: '공지사항',
  pins: '관심 업무',
  status: '현황 (로드맵 · 장비)',
}
/**
 * 기본 배치 — 3열 그리드(2026-08-05 사용자 지시).
 * 들어오자마자 궁금한 순서가 ① 오늘 일정 ② 진행 중 업무 ③ 공지사항이라, 그 순서로 자리를 준다.
 *   1행: 오늘 일정(2칸 — 아래에 간소화 주간 달력) · 진행 중 업무(큰 숫자 + 제목만)
 *   2행: 공지사항 · 안 본 새 글 · 업무 구성
 *   그 아래: 관심 업무 · 현황(전폭, 접힘)
 */
const DEFAULT_ORDER: SectionId[] = ['today', 'work', 'notice', 'kpi', 'mix', 'pins', 'status']
/** 넓은 자리가 필요한 카드는 칸을 합친다 */
const SECTION_SPAN: Record<SectionId, number> = {
  today: 2, work: 1, notice: 1, kpi: 1, mix: 1, pins: 3, status: 3,
}
const isSectionId = (v: unknown): v is SectionId => typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v)

/**
 * 개인 배치 저장 키 — **v2**(2026-08-05).
 *
 * v1(`home.order`/`home.hidden`)을 이어 쓸 수 없다: 개편에서 `kpi`·`work`·`notice` 는 id 이름만 같고
 * 담는 내용과 차지하는 칸 수(span)가 완전히 달라졌다. 옛 순서가 그대로 적용되면서
 * '업무 → KPI → 공지' 로 재배열됐고, 칸 합치기와 어긋나 빈자리가 생겼다(사용자 신고 화면).
 * 키를 새로 두면 모두 기본 배치에서 다시 시작한다. 옛 값은 남겨 두되 읽지 않는다.
 */
const ORDER_KEY = 'home.order2'
const HIDDEN_KEY = 'home.hidden2'

export default function Home() {
  const dispatch = useAppDispatch()
  const { isMember } = useRole()
  // 홈 배치 개인화 — 저장 순서(모르는 id 무시 + 누락 id는 기본 순서로 뒤에 병합)와 숨김 집합.
  // 저장/편집 UI는 설정 로드 '성공'(loadedOk) 세션에서만(서버 상태 모르고 덮어쓰기 방지 — 필터와 동일 기준).
  const usLoadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const svOrder = useAppSelector((s) => s.userSettings.settings[ORDER_KEY])
  const svHidden = useAppSelector((s) => s.userSettings.settings[HIDDEN_KEY])
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
    dispatch(putSetting({ key: ORDER_KEY, value: next }))
  }
  const toggleHide = (id: SectionId) => {
    const next = hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id]
    dispatch(putSetting({ key: HIDDEN_KEY, value: next }))
  }
  const resetLayout = () => {
    dispatch(putSetting({ key: ORDER_KEY, value: DEFAULT_ORDER }))
    dispatch(putSetting({ key: HIDDEN_KEY, value: [] }))
  }

  // 각 카드가 제목·건수·전체보기를 스스로 그린다(HomeCard 공용 규격) — 바깥에서 제목을 또 붙이지 않는다
  const sectionNode: Record<SectionId, ReactNode> = {
    kpi: <HomeKpi />,
    today: <ScheduleSection />,
    mix: <WorkMixCard />,
    work: <WorkStatusSection />,
    notice: <NoticeSection />,
    pins: <PinnedWorksSection />,
    status: <StatusSummary />,
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

      {/* FAB 구축 로드맵 — **방문자에게만 크게**(2026-08-05 사용자 확정).
          홈은 비로그인도 들어오는 유일한 화면이고 게스트에게는 로드맵·행사·바로가기뿐이라 여기서는 얼굴 역할을 한다.
          로그인한 구성원에게는 다음 변화가 2026.12라 매일 볼 것이 아니므로 '현황' 줄(StatusSummary)에 접어 둔다. */}
      {!isMember && (
        <ContentSection last>
          <RoadmapCard showLegend={false} showBadges={false} />
        </ContentSection>
      )}

      {/* 구성원 대시보드 — 3열 그리드에 카드를 흘려 넣는다(계정별 순서·숨김 적용).
          좁은 화면(md 미만)은 한 줄에 하나 — 칸 합치기(span)는 3열일 때만 의미가 있다. */}
      {isMember && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          {visible.map((id) => (
            <Box key={id} sx={{ gridColumn: { xs: 'span 1', md: `span ${SECTION_SPAN[id]}` }, minWidth: 0 }}>
              {sectionNode[id]}
            </Box>
          ))}
        </Box>
      )}
    </PageContainer>
  )
}
