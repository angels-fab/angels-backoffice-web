import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import { dataTableSx } from '@/components/ds'
import { typescale } from '@/theme/tokens'
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
  onToggleSelf: (eventId: string) => void; onAddName: (eventId: string, name: string) => void; onRemove: (row: AttendeeRow) => void
}) {
  const canToggle = isMember && !!user
  return (
    /* 레거시 .eq-ledger → MUI Table 이관(2026-08-01). 셀 여백·글자·헤더 룩은 theme MuiTableCell 정본이 담당.
       정렬은 셀 align prop 으로만 — 구 '& th, & td': textAlign center !important 는 .eq-ledger 의
       좌측정렬(특이도 0-1-1)을 이기려고 붙인 것이라, 클래스가 사라진 지금은 필요 없다.
       data-ended-list = 상세 패널의 바깥클릭 판정용 기능 훅(Events/index.tsx). 스타일 클래스와 분리해 둔다.
       모바일은 카드화 대신 열 숨김 유지(2026-08-01 사용자 결정: 카드 전환은 장비대장만). */
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" data-ended-list sx={{ ...dataTableSx, minWidth: { xs: 0, sm: 680 } }}>
        <TableHead>
          <TableRow>
            <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>구분</TableCell>
            <TableCell align="left">행사명</TableCell>
            <TableCell align="center">기간</TableCell>
            <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>장소</TableCell>
            <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>참석자</TableCell>
            <TableCell align="center">참/불</TableCell>
            {isAdmin && <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>관리</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e) => {
            const cat = eventCategory(e.kind)
            const color = CAT_COLOR[cat]
            const on = selectedId === e.id
            const rows = attByEvent[e.id] ?? []
            const attendees = e.attendees ?? []
            const mine = !!user && rows.some((r) => r.memberUid && r.name === user)
            return (
              <TableRow
                hover
                key={e.id}
                onClick={() => onPick(e)}
                sx={(th) => ({ cursor: 'pointer', ...(on && { '& td': { bgcolor: `${th.palette.primary.main}22` } }) })}
              >
                <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Box component="span" className="lg-chip" sx={{ color, borderColor: color + '66' }}>{cat}</Box>
                </TableCell>
                {/* 행사명 = 이 행의 식별자. 구 .lg-primary(14/500 주톤)를 sx로 옮김 */}
                <TableCell align="left" sx={{ color: 'text.primary', fontWeight: 500, fontSize: typescale.emphasis.size, whiteSpace: 'normal' }}>{e.title}</TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{fmtEventDate(e.start, e.end)}</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary' }}>{e.venue || '-'}</TableCell>
                <TableCell
                  align="center"
                  title={attendees.join(', ')}
                  sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {attendees.length ? `${attendees.join(', ')} (${attendees.length})` : '-'}
                </TableCell>
                {/* 참/불 스위치 — 로그인 팀원만 토글, 그 외에는 상태 표시(비활성) */}
                <TableCell align="center" onClick={(ev) => ev.stopPropagation()} sx={{ cursor: 'default' }}>
                  {canToggle ? (
                    <AttendSwitch checked={mine} disabled={busy} onToggle={() => onToggleSelf(e.id)} />
                  ) : (
                    <Box component="span" sx={{ color: 'text.disabled', fontSize: typescale.small.size }}>-</Box>
                  )}
                </TableCell>
                {/* 관리 — 관리자 참석자 추가/제거 */}
                {isAdmin && (
                  <TableCell align="center" onClick={(ev) => ev.stopPropagation()} sx={{ display: { xs: 'none', sm: 'table-cell' }, cursor: 'default' }}>
                    <AttendeeManageCell
                      rows={rows}
                      user={user}
                      isMember={isMember}
                      isAdmin={isAdmin}
                      busy={busy}
                      onAddName={(n) => onAddName(e.id, n)}
                      onRemove={onRemove}
                    />
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
  )
}
