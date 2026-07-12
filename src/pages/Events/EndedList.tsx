import Box from '@mui/material/Box'
import { fmtEventDate, type FabEvent } from '@/constants/events'
import { eventCategory, CAT_COLOR } from './eventCard'
import AttendSwitch from './AttendSwitch'
import AttendeeManageCell from './AttendeeManageCell'
import type { AttendeeRow } from '@/api/events'

/**
 * 종료된 행사 — 카드 대신 밀도 높은 목록형. 종료일 내림차순은 부모에서 정렬해 전달.
 * 행 클릭 → 상세(부모가 비모달 우측 Drawer로 표시, 연속 열람 가능). 선택된 행은 하이라이트.
 * 헤더 순서: 구분 · 행사명 · 기간 · 장소 · 참석자 · 참/불(스위치) · 관리(관리자만).
 * 참/불 스위치 = 로그인 팀원 본인 참석 토글(가장 우측), 관리 = 관리자 참석자 추가/제거(스위치 우측).
 */
export default function EndedList({ events, selectedId, onPick, attByEvent, user, isMember, isAdmin, busy, onToggleSelf, onAddName, onRemove }: {
  events: FabEvent[]; selectedId?: string | null; onPick: (e: FabEvent) => void
  attByEvent: Record<string, AttendeeRow[]>
  user: string | null; isMember: boolean; isAdmin: boolean; busy: boolean
  onToggleSelf: (eventId: string) => void; onAddName: (eventId: string, name: string) => void; onRemove: (id: number) => void
}) {
  const canToggle = isMember && !!user
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" className="eq-ledger" sx={{ width: '100%', minWidth: { xs: 0, sm: 680 }, '& th, & td': { textAlign: 'center !important' } }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>구분</Box>
            <Box component="th">행사명</Box>
            <Box component="th">기간</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>장소</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>참석자</Box>
            <Box component="th">참/불</Box>
            {isAdmin && <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>관리</Box>}
          </Box>
        </Box>
        <Box component="tbody">
          {events.map((e) => {
            const cat = eventCategory(e.kind)
            const color = CAT_COLOR[cat]
            const on = selectedId === e.id
            const rows = attByEvent[e.id] ?? []
            const attendees = e.attendees ?? []
            const mine = !!user && rows.some((r) => r.memberUid && r.name === user)
            return (
              <Box
                component="tr"
                key={e.id}
                onClick={() => onPick(e)}
                sx={(th) => ({ cursor: 'pointer', ...(on && { '& td': { bgcolor: `${th.palette.primary.main}22` } }) })}
              >
                <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Box component="span" className="lg-chip" sx={{ color, borderColor: color + '66' }}>{cat}</Box>
                </Box>
                <Box component="td" className="lg-primary" sx={{ whiteSpace: 'normal' }}>{e.title}</Box>
                <Box component="td" sx={{ whiteSpace: 'nowrap' }}>{fmtEventDate(e.start, e.end)}</Box>
                <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary' }}>{e.venue || '-'}</Box>
                <Box
                  component="td"
                  title={attendees.join(', ')}
                  sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {attendees.length ? `${attendees.join(', ')} (${attendees.length})` : '-'}
                </Box>
                {/* 참/불 스위치 — 로그인 팀원만 토글, 그 외에는 상태 표시(비활성) */}
                <Box component="td" onClick={(ev) => ev.stopPropagation()} sx={{ cursor: 'default' }}>
                  {canToggle ? (
                    <AttendSwitch checked={mine} disabled={busy} onToggle={() => onToggleSelf(e.id)} />
                  ) : (
                    <Box component="span" sx={(th) => ({ color: 'text.disabled', fontSize: th.typography.small.fontSize })}>-</Box>
                  )}
                </Box>
                {/* 관리 — 관리자 참석자 추가/제거 */}
                {isAdmin && (
                  <Box component="td" onClick={(ev) => ev.stopPropagation()} sx={{ display: { xs: 'none', sm: 'table-cell' }, cursor: 'default' }}>
                    <AttendeeManageCell
                      rows={rows}
                      user={user}
                      isMember={isMember}
                      isAdmin={isAdmin}
                      busy={busy}
                      onAddName={(n) => onAddName(e.id, n)}
                      onRemove={onRemove}
                    />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
