import { useState } from 'react'
import Box from '@mui/material/Box'
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import type { WorkHistoryRow } from '@/api/works'

/**
 * 업무 변경 이력 목록 — 카드의 시계 버튼에서 펼치는 팝오버 내용(개선요청 66).
 *
 * 읽기 전용이다. 기록은 DB 트리거가 하고 앱은 손대지 않는다(docs/db/work-history.sql).
 * 소급이 안 되므로 **켠 날 이전의 변경은 없다** — 그 사실을 목록 끝에 한 줄로 알린다.
 */

/**
 * 저장된 시각(ISO) → 'MM-DD HH:mm'(서울). 같은 해 안에서만 보는 목록이라 연도는 접는다.
 *
 * 로케일 문자열을 그대로 쓰거나 구두점을 바꿔치기하면 순서·모양이 제각각이다 —
 * ko-KR 은 '08-12-10:42' 로 뭉개지고, sv-SE 는 월·일만 주면 '12/08' 로 뒤집힌다(둘 다 실측).
 * 그래서 조각을 직접 꺼내 맞춘다.
 */
function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${at('month')}-${at('day')} ${at('hour')}:${at('minute')}`
}

/** 본문·서식처럼 값을 나란히 못 보여주는 항목인가 — 글이 길어 팝오버를 삼킨다 */
const isBody = (field: string) => field === '내용' || field === '서식'

function Row({ h }: { h: WorkHistoryRow }) {
  const [openBody, setOpenBody] = useState(false)
  const body = isBody(h.field)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '78px 1fr', columnGap: 1.25, alignItems: 'baseline' }}>
      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
        {stamp(h.at)}
      </Box>
      <Box sx={{ minWidth: 0, fontSize: typescale.body.size, lineHeight: 1.6 }}>
        {body ? (
          <>
            <Box component="span">{h.field === '내용' ? '내용 수정' : '서식 변경'}</Box>
            {h.author && <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}> · {h.author}</Box>}
            {/* 이전 글은 접어 둔다 — 펼쳐 두면 이력 한 줄이 팝오버를 다 차지한다 */}
            {h.field === '내용' && !!h.prev && (
              <Box
                component="button"
                type="button"
                onClick={() => setOpenBody((v) => !v)}
                sx={{
                  ml: 0.75, p: 0, font: 'inherit', fontSize: typescale.caption.size, cursor: 'pointer',
                  bgcolor: 'transparent', border: 'none', color: 'primary.main', textDecoration: 'underline',
                }}
              >
                {openBody ? '접기' : '이전 글 보기'}
              </Box>
            )}
            {openBody && (
              <Box sx={(th) => ({
                mt: 0.5, p: 1, maxHeight: 160, overflowY: 'auto',
                border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.chip}px`,
                bgcolor: 'background.elevated',
                fontSize: typescale.small.size, color: 'text.secondary', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              })}>
                {h.prev}
              </Box>
            )}
          </>
        ) : (
          <>
            <Box component="span" sx={{ color: 'text.secondary' }}>{h.field} </Box>
            <Box component="span" sx={{ color: 'text.disabled' }}>{h.prev || '없음'}</Box>
            <ArrowRightAltIcon sx={{ fontSize: iconSize.body, color: 'text.disabled', verticalAlign: 'middle', mx: 0.5 }} />
            <Box component="span" sx={{ fontWeight: weight.semibold }}>{h.next || '없음'}</Box>
            {h.author && <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}> · {h.author}</Box>}
          </>
        )}
      </Box>
    </Box>
  )
}

export default function WorkHistoryList({ rows }: { rows: WorkHistoryRow[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, letterSpacing: '0.04em', color: 'text.disabled' }}>
        변경 이력
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 280, overflowY: 'auto' }}>
        {rows.map((h) => <Row key={h.id} h={h} />)}
      </Box>
      {/* 소급 불가 — 이 줄이 없으면 '예전엔 아무 일도 없었다'로 읽힌다 */}
      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>
        2026-08-12부터 기록합니다. 그 전 변경은 남아 있지 않습니다.
      </Box>
    </Box>
  )
}
