import Box from '@mui/material/Box'
import { fmtEventDate, type FabEvent } from '@/constants/events'
import { eventCategory, CAT_COLOR } from './eventCard'

/**
 * 종료된 행사 — 카드 대신 밀도 높은 목록형. 종료일 내림차순은 부모에서 정렬해 전달.
 * 행 클릭 → 상세(부모가 비모달 우측 Drawer로 표시, 연속 열람 가능). 선택된 행은 하이라이트.
 * 헤더 순서: 구분 · 행사명 · 기간 · 장소. 모두 가운데 정렬. 모바일은 구분·장소 숨김.
 */
export default function EndedList({ events, selectedId, onPick }: { events: FabEvent[]; selectedId?: string | null; onPick: (e: FabEvent) => void }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" className="eq-ledger" sx={{ width: '100%', minWidth: { xs: 0, sm: 640 }, '& th, & td': { textAlign: 'center !important' } }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>구분</Box>
            <Box component="th">행사명</Box>
            <Box component="th">기간</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>장소</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>참석자</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {events.map((e) => {
            const cat = eventCategory(e.kind)
            const color = CAT_COLOR[cat]
            const on = selectedId === e.id
            const attendees = e.attendees ?? []
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
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
