import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState, SegTabs, useSnack } from '@/components/ds'
import { radius, shadow } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { FAB_EVENTS, eventStatus, type FabEvent } from '@/constants/events'
import { fetchAttendees, addAttendee, removeAttendee, fetchSubmissions, type AttendeeRow, type EventSubmissionRow } from '@/api/events'
import { EventCardInner, EventDrawerDetail } from './eventCard'
import MobileCarousel from './MobileCarousel'
import EndedList from './EndedList'
import SubmitEventModal from './SubmitEventModal'
import SubmissionsAdmin from './SubmissionsAdmin'

// PC 카드 — 인터랙션(클릭/포커스/hover) 래퍼 + 공용 비주얼(EventCardInner).
function EventCard({ e, open, onToggle }: { e: FabEvent; open: boolean; onToggle: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${e.title} 상세 ${open ? '닫기' : '열기'}`}
      onClick={onToggle}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle() } }}
      sx={{
        position: 'relative', borderRadius: `${radius.modal}px`, overflow: 'hidden', border: 1, borderColor: 'divider', cursor: 'pointer',
        transition: 'box-shadow .18s ease, transform .18s ease',
        ...(open
          ? { boxShadow: shadow.lg }
          : { '&:hover': { transform: 'translateY(-3px) scale(1.012)', boxShadow: shadow.sm } }),
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <EventCardInner e={e} open={open} />
    </Box>
  )
}

type Tab = 'active' | 'ended'

/**
 * 학술·교육·전시 행사 — 진행·예정 / 종료 2탭(PC·모바일 동일 분류).
 * 진행·예정 = 카드(PC 그리드 / 모바일 캐러셀, 진행중 먼저·예정 start asc). 종료 = 밀도 목록(end desc, 행 클릭 상세).
 */
export default function Events() {
  const { isAdmin, isMember, user } = useRole()
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true })
  const [tab, setTab] = useState<Tab>('active')
  const [openId, setOpenId] = useState<string | null>(null)
  const [endedDetail, setEndedDetail] = useState<FabEvent | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [attBusy, setAttBusy] = useState(false)
  const snack = useSnack()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submissions, setSubmissions] = useState<EventSubmissionRow[]>([])
  const [subOpen, setSubOpen] = useState(false)

  // 날짜 기준 분류: 진행중(green)+예정(amber)=진행·예정 / 종료(gray). 진행중 먼저, 예정은 start asc / 종료는 end desc.
  const { active, ended } = useMemo(() => {
    const act: FabEvent[] = [], end: FabEvent[] = []
    FAB_EVENTS.forEach((e) => (eventStatus(e.start, e.end).tone === 'gray' ? end : act).push(e))
    act.sort((a, b) => {
      const ta = eventStatus(a.start, a.end).tone, tb = eventStatus(b.start, b.end).tone
      if (ta !== tb) return ta === 'green' ? -1 : 1 // 진행중 먼저
      return a.start.localeCompare(b.start) // 예정 start asc
    })
    end.sort((a, b) => (b.end || b.start).localeCompare(a.end || a.start)) // 종료 end desc
    return { active: act, ended: end }
  }, [])

  // 참석자 — 행사 id별 그룹(DB). 마운트 시 로드.
  const refetchAtt = () => { void fetchAttendees().then(setAttendees).catch(() => {}) }
  useEffect(() => { refetchAtt() }, [])
  const attByEvent = useMemo(() => {
    const m: Record<string, AttendeeRow[]> = {}
    for (const a of attendees) (m[a.eventId] ||= []).push(a)
    return m
  }, [attendees])
  // 종료 목록 표시용 — DB 참석자 이름 병합(없으면 상수값)
  const endedView = useMemo(() => ended.map((e) => ({ ...e, attendees: attByEvent[e.id]?.map((a) => a.name) ?? e.attendees })), [ended, attByEvent])

  const attErr = (err: unknown) => snack(err instanceof Error ? err.message : '오류가 발생했습니다', 'error')
  // 본인 참석 토글(팀원) — 이미 있으면 취소, 없으면 추가
  const toggleSelf = async (eventId: string) => {
    if (!user) return
    setAttBusy(true)
    try {
      const mine = attByEvent[eventId]?.find((r) => r.memberUid && r.name === user)
      if (mine) await removeAttendee(mine.id)
      else await addAttendee({ eventId, name: user, self: true })
      refetchAtt()
    } catch (err) { attErr(err) } finally { setAttBusy(false) }
  }
  // 관리자 수기추가
  const addAttName = async (eventId: string, name: string) => {
    setAttBusy(true)
    try { await addAttendee({ eventId, name, self: false }); refetchAtt() } catch (err) { attErr(err) } finally { setAttBusy(false) }
  }
  const removeAtt = async (id: number) => {
    setAttBusy(true)
    try { await removeAttendee(id); refetchAtt() } catch (err) { attErr(err) } finally { setAttBusy(false) }
  }

  // 관리자 — 신청(제출) 대기 목록. 마운트·제출 후 로드.
  const refetchSubs = () => { if (isAdmin) void fetchSubmissions().then(setSubmissions).catch(() => {}) }
  useEffect(() => { refetchSubs() }, [isAdmin])
  const pendingCount = submissions.filter((s) => s.status === 'pending').length

  // Escape로 열린 카드/상세 닫기 (PC 그리드·종료 상세 패널)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setOpenId(null); setEndedDetail(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 종료 상세 패널 바깥 클릭 시 닫기 — 단, 목록 행 클릭은 '전환'(닫지 않음), 패널 안 클릭은 유지
  useEffect(() => {
    if (!endedDetail) return
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement
      if (panelRef.current?.contains(t)) return       // 패널 내부 → 유지
      if (t.closest('.eq-ledger tbody tr')) return      // 목록 행 → 다른 행사로 전환(onPick)
      if (t.closest('.MuiPopover-root, .MuiModal-root')) return // 관리자 참석자 관리 팝오버 등 → 유지
      setEndedDetail(null)                              // 그 외 바깥 → 닫기
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [endedDetail])

  return (
    <PageContainer>
      <PageHeader
        icon={<CoPresentIcon />}
        title="학술·교육·전시"
        actions={
          isMember ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isAdmin && pendingCount > 0 && (
                <Button variant="outlined" color="warning" size="small" onClick={() => setSubOpen(true)} sx={{ whiteSpace: 'nowrap' }}>
                  신청 대기 {pendingCount}
                </Button>
              )}
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSubmitOpen(true)}>
                새 행사
              </Button>
            </Box>
          ) : undefined
        }
      />

      {/* 진행·예정 / 종료 탭 (건수 표시) */}
      <SegTabs
        ariaLabel="행사 상태 전환"
        items={[
          { value: 'active', label: `진행·예정 ${active.length}` },
          { value: 'ended', label: `종료 ${ended.length}` },
        ] as const}
        value={tab}
        onChange={setTab}
        sx={{ mb: 2 }}
      />

      <ContentSection last>
        {tab === 'active' ? (
          active.length === 0 ? (
            <AppCard padding={0}>
              <EmptyState icon={<CoPresentIcon />} title="진행 중이거나 예정된 행사가 없습니다" description="새 행사가 등록되면 여기에 표시됩니다." />
            </AppCard>
          ) : isMobile ? (
            <MobileCarousel events={active} />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '14px', alignItems: 'start' }}>
              {active.map((e) => (
                <EventCard key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId((prev) => (prev === e.id ? null : e.id))} />
              ))}
            </Box>
          )
        ) : ended.length === 0 ? (
          <AppCard padding={0}>
            <EmptyState icon={<CoPresentIcon />} title="종료된 행사가 없습니다" />
          </AppCard>
        ) : (
          <AppCard padding={0} sx={{ transition: 'margin-right .22s ease', ...(endedDetail && { mr: { md: '396px' } }) }}>
            {/* 같은 행사를 다시 누르면 닫힘(토글), 다른 행사면 전환. 참석 스위치·관리는 목록 안에서. */}
            <EndedList
              events={endedView}
              selectedId={endedDetail?.id ?? null}
              onPick={(e) => setEndedDetail((prev) => (prev?.id === e.id ? null : e))}
              attByEvent={attByEvent}
              user={user}
              isMember={isMember}
              isAdmin={isAdmin}
              busy={attBusy}
              onToggleSelf={(id) => void toggleSelf(id)}
              onAddName={(id, n) => void addAttName(id, n)}
              onRemove={(id) => void removeAtt(id)}
            />
          </AppCard>
        )}
      </ContentSection>

      {/* 종료 행사 상세 — 비모달 고정 패널(상단바 아래 오른쪽). 목록은 계속 클릭 가능(다른 행사 연속 열람),
          바깥 클릭·X·Esc로 닫힘. 포스터를 풀사이즈로 보여주고 그 아래에 상세(EventDrawerDetail). */}
      {endedDetail && (
        <Box
          ref={panelRef}
          role="dialog"
          aria-label={`${endedDetail.title} 상세`}
          sx={{
            position: 'fixed', top: { xs: 48, md: 54 }, right: 0, bottom: { xs: 60, md: 0 },
            width: 380, maxWidth: '92vw', zIndex: 1200,
            bgcolor: 'background.default', borderLeft: 1, borderColor: 'divider',
            boxShadow: '-8px 0 26px rgba(0,0,0,.42)', p: 1.5, overflowY: 'auto',
          }}
        >
          <IconButton
            onClick={() => setEndedDetail(null)}
            aria-label="상세 닫기"
            size="small"
            sx={{ position: 'absolute', top: 12, right: 12, zIndex: 4, bgcolor: 'rgba(0,0,0,.5)', color: 'common.white', '&:hover': { bgcolor: 'rgba(0,0,0,.72)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          {/* 상세 드로어는 참석자 이름만 읽기전용 표시(조작은 목록에서). endedView가 DB 이름을 병합해 전달 */}
          <EventDrawerDetail e={endedDetail} />
        </Box>
      )}

      {/* 새 행사 신청 팝업(팀원+) */}
      <SubmitEventModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        user={user}
        onSubmitted={() => { setSubmitOpen(false); snack('행사를 신청했습니다. 관리자 검토 후 게시됩니다.'); refetchSubs() }}
        onError={(m) => snack(m, 'error')}
      />
      {/* 관리자 — 신청 대기·검토 */}
      {isAdmin && (
        <SubmissionsAdmin open={subOpen} onClose={() => setSubOpen(false)} submissions={submissions} onChanged={refetchSubs} onError={(m) => snack(m, 'error')} />
      )}
    </PageContainer>
  )
}
