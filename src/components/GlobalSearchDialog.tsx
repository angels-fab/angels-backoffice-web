import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CampaignIcon from '@mui/icons-material/Campaign'
import AssessmentIcon from '@mui/icons-material/Assessment'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import MonitorIcon from '@mui/icons-material/Monitor'
import { SearchBar, StatusChip, EmptyState } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { radius } from '@/theme/tokens'
import { useAppSelector } from '@/store/hooks'
import { classify, taskTitle, W_STATUS } from '@/pages/Work/workMeta'
import { noticeCatStatus } from '@/pages/Notice/noticeMeta'
import { eqStateKey, EQ_STATE } from '@/pages/EquipmentOps/eqMeta'
import { groupStage, phaseChip, todayHalfIndex } from '@/pages/Equipment/stageMeta'

export interface GlobalSearchDialogProps {
  open: boolean
  onClose: () => void
}

interface Hit {
  id: string
  title: string
  subtitle?: string
  status?: { label: string; kind: StatusKind }
  to: string
}
interface Group {
  key: string
  label: string
  icon: ReactNode
  hits: Hit[]
  /** 상한 초과로 잘린 건수 */
  more: number
}

const MAX_PER_GROUP = 20
const stripHTML = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ')

/**
 * 통합검색 — 공지·업무·장비(도입/운영) 4개 데이터 소스를 클라이언트 메모리에서 검색.
 * 결과를 소스별로 그룹화하고, 클릭 시 해당 페이지로 이동(가능하면 상세 Drawer 자동 오픈).
 * 데이터는 MainLayout이 앱 진입 시 미리 로드해 둔 Redux store를 그대로 읽는다.
 */
export default function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const work = useAppSelector((s) => s.work.items)
  const notices = useAppSelector((s) => s.notice.items)
  const groups = useAppSelector((s) => s.eq.groups)
  const months = useAppSelector((s) => s.eq.months)
  const allReady = useAppSelector((s) => s.work.ready && s.notice.ready && s.eq.ready)

  const todayHalf = useMemo(() => todayHalfIndex(months), [months])

  const groupsResult = useMemo<Group[]>(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return []
    const match = (text: string) => {
      const t = text.toLowerCase()
      return terms.every((term) => t.includes(term))
    }
    const take = (all: Hit[]): { hits: Hit[]; more: number } => ({
      hits: all.slice(0, MAX_PER_GROUP),
      more: Math.max(0, all.length - MAX_PER_GROUP),
    })

    // ① 공지사항 — 제목·작성자·분류·내용
    const noticeHits: Hit[] = notices
      .filter((n) => match(`${n.title} ${n.author} ${n.cat} ${stripHTML(n.body)}`))
      .map((n) => ({
        id: `notice-${n.id}`,
        title: n.title || '(제목 없음)',
        subtitle: [n.author || '작성자 미상', n.dept].filter(Boolean).join(' · '),
        status: { label: n.cat || '공지', kind: noticeCatStatus(n.cat) },
        to: `/notice/${encodeURIComponent(n.num)}`,
      }))

    // ② 업무현황 — 제목·담당자·분류·상태
    const workHits: Hit[] = work
      .filter((t) => {
        const st = W_STATUS[classify(t)].label
        const flags = `${t.chief ? '검토 필요' : ''} ${t.remind ? 'Remind' : ''}`
        return match(`${t.task} ${t.mgr} ${t.cat} ${st} ${flags}`)
      })
      .map((t) => {
        const st = W_STATUS[classify(t)]
        return {
          id: `work-${t.id}`,
          title: taskTitle(t),
          subtitle: [t.mgr || '담당 미지정', t.cat].filter(Boolean).join(' · '),
          status: { label: st.label, kind: st.status },
          to: `/work?focus=${t.id}`,
        }
      })

    // ③ 장비도입관리 — 장비명·담당자·도입방법·진행단계.
    // 같은 장비명(여러 도입배치)은 검색결과 1건(종 기준)으로 합침 — 대수 합산, key 중복 방지. 딥링크는 장비명으로(해당 페이지서 첫 배치 포커스).
    const projByName = new Map<string, { g: (typeof groups)[number]; info: ReturnType<typeof groupStage>; total: number }>()
    groups
      .map((g) => ({ g, info: groupStage(g.timeline, months, todayHalf) }))
      .filter(({ g, info }) => match(`${g.name} ${g.mgr} ${g.bid} ${g.type} ${phaseChip(info).label}`))
      .forEach(({ g, info }) => {
        const cur = projByName.get(g.name)
        if (cur) cur.total += g.count
        else projByName.set(g.name, { g, info, total: g.count })
      })
    const eqProjHits: Hit[] = [...projByName.values()].map(({ g, info, total }) => {
      const chip = phaseChip(info)
      return {
        id: `eqproj-${g.name}`,
        title: total > 1 ? `${g.name} (${total}대)` : g.name,
        subtitle: [g.mgr || '담당 미지정', g.bid || g.type].filter(Boolean).join(' · '),
        status: { label: chip.label, kind: chip.status },
        to: `/equipment?focus=${encodeURIComponent(g.name)}`,
      }
    })

    // ④ 장비운영관리 — 장비명·분류·담당자·상태. 동일 장비명 1건 합산(종 기준).
    const opsByName = new Map<string, { g: (typeof groups)[number]; total: number }>()
    groups
      .filter((g) => match(`${g.name} ${g.cat} ${g.mgr} ${EQ_STATE[eqStateKey(g.state)].label}`))
      .forEach((g) => {
        const cur = opsByName.get(g.name)
        if (cur) cur.total += g.count
        else opsByName.set(g.name, { g, total: g.count })
      })
    const eqOpsHits: Hit[] = [...opsByName.values()].map(({ g, total }) => {
      const st = EQ_STATE[eqStateKey(g.state)]
      return {
        id: `eqops-${g.name}`,
        title: total > 1 ? `${g.name} (${total}대)` : g.name,
        subtitle: [g.mgr || '담당 미지정', g.cat].filter(Boolean).join(' · '),
        status: { label: st.label, kind: st.status },
        to: `/equipment-ops?focus=${encodeURIComponent(g.name)}`,
      }
    })

    return [
      { key: 'notice', label: '공지사항', icon: <CampaignIcon fontSize="small" />, ...take(noticeHits) },
      { key: 'work', label: '업무현황', icon: <AssessmentIcon fontSize="small" />, ...take(workHits) },
      { key: 'eqproj', label: '장비도입관리', icon: <LocalShippingIcon fontSize="small" />, ...take(eqProjHits) },
      { key: 'eqops', label: '장비운영관리', icon: <MonitorIcon fontSize="small" />, ...take(eqOpsHits) },
    ].filter((g) => g.hits.length > 0)
  }, [q, notices, work, groups, months, todayHalf])

  const total = groupsResult.reduce((s, g) => s + g.hits.length, 0)
  const queried = q.trim().length > 0
  const firstHit = groupsResult[0]?.hits[0]

  const close = () => {
    setQ('')
    onClose()
  }
  const go = (to: string) => {
    close()
    navigate(to)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      fullWidth
      maxWidth="sm"
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
      slotProps={{
        paper: {
          sx: { bgcolor: 'background.paper', borderRadius: `${radius.modal}px`, mt: { xs: 3, sm: 8 }, width: '100%' },
        },
      }}
    >
      {/* 검색 입력 — Enter 시 첫 결과로 이동 */}
      <Box
        sx={{ p: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && firstHit) {
            e.preventDefault()
            go(firstHit.to)
          }
        }}
      >
        <SearchBar value={q} onChange={setQ} placeholder="공지·업무·장비 통합 검색" width="100%" autoFocus />
      </Box>

      <Box sx={{ maxHeight: { xs: '62vh', sm: 460 }, overflowY: 'auto', p: 1 }}>
        {!queried ? (
          <Box sx={{ px: 1.5, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
              검색어를 입력하세요
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
              <StatusChip status="info" label="공지사항" />
              <StatusChip status="success" label="업무현황" />
              <StatusChip status="warning" label="장비도입관리" />
              <StatusChip status="teal" label="장비운영관리" />
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.disabled' }}>
              제목·담당자·분류·상태·내용을 한 번에 검색합니다
            </Typography>
          </Box>
        ) : total === 0 ? (
          <EmptyState size="sm" title="검색 결과가 없습니다" description="다른 키워드로 검색해 보세요." />
        ) : (
          groupsResult.map((g) => (
            <Box key={g.key} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.75, color: 'text.secondary' }}>
                {g.icon}
                <Typography variant="subtitle2" sx={{ color: 'text.primary' }}>
                  {g.label}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  ({g.hits.length + g.more})
                </Typography>
              </Box>
              {g.hits.map((hit) => (
                <Box
                  key={hit.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${g.label}: ${hit.title}`}
                  onClick={() => go(hit.to)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      go(hit.to)
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 1,
                    borderRadius: `${radius.modal}px`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'background.elevated' },
                    '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                  }}
                >
                  {hit.status && <StatusChip status={hit.status.kind} label={hit.status.label} />}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hit.title}
                    </Typography>
                    {hit.subtitle && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hit.subtitle}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
              {g.more > 0 && (
                <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, color: 'text.disabled' }}>
                  상위 {MAX_PER_GROUP}건 표시 · 외 {g.more}건 (검색어를 더 구체적으로)
                </Typography>
              )}
            </Box>
          ))
        )}

        {queried && !allReady && (
          <Typography variant="caption" sx={{ display: 'block', px: 1, py: 1, color: 'text.disabled', textAlign: 'center' }}>
            일부 데이터를 아직 불러오는 중입니다…
          </Typography>
        )}
      </Box>
    </Dialog>
  )
}
