import Box from '@mui/material/Box'
import { fmtEventDate, type FabEvent } from '@/constants/events'
import { eventCategory, CAT_COLOR } from './eventCard'

/**
 * 종료된 행사 — 카드 대신 밀도 높은 목록형. 종료일 내림차순은 부모에서 정렬해 전달.
 * 행 클릭 → 상세(부모가 다이얼로그로 표시). 모바일은 구분·장소 열을 숨겨 핵심(행사명·기간)만.
 */
export default function EndedList({ events, onPick }: { events: FabEvent[]; onPick: (e: FabEvent) => void }) {
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" className="eq-ledger" sx={{ width: '100%', minWidth: { xs: 0, sm: 640 } }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th">행사명</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>구분</Box>
            <Box component="th">기간</Box>
            <Box component="th" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>장소</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {events.map((e) => {
            const cat = eventCategory(e.kind)
            const color = CAT_COLOR[cat]
            return (
              <Box component="tr" key={e.id} onClick={() => onPick(e)} sx={{ cursor: 'pointer' }}>
                <Box component="td" className="lg-primary" sx={{ whiteSpace: 'normal' }}>{e.title}</Box>
                <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  <Box component="span" className="lg-chip" sx={{ color, borderColor: color + '66' }}>{cat}</Box>
                </Box>
                <Box component="td" sx={{ whiteSpace: 'nowrap' }}>{fmtEventDate(e.start, e.end)}</Box>
                <Box component="td" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary' }}>{e.venue || '-'}</Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
