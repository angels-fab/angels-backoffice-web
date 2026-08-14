import Box from '@mui/material/Box'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { EmptyState } from '@/components/ds'
import { alpha } from '@mui/material/styles'
import { fmtEventDate, regStatus, type FabEvent } from '@/constants/events'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import { EventCatChip, EventStatusChip } from './eventCard'

/**
 * 모바일(<=768px) 진행·예정 목록 — **압축 목록형**(개선요청 72, 사용자가 1번 안 선택 2026-08-13).
 *
 * 종전엔 가로 스냅 캐러셀이었다. 카드 폭이 화면의 86%로 고정돼 있고 포스터 비율이 800:1122 라
 * **행사 1건이 403px**(본문 높이의 58%)을 먹었고, 5건을 보려면 옆으로 4번 밀어야 했다.
 * 세로 여백은 오히려 76px 이 남았다 — 제목·날짜·칩이 전부 포스터 위에 겹쳐 그려져(absolute)
 * 높이에 1px 도 기여하지 않기 때문에, 글자를 줄여도 보이는 건수는 1건 그대로였다.
 *
 * 그래서 세로 목록으로 되돌리고 포스터를 58px 썸네일로 강등한다 — 한 줄 104px, **5건이 한 화면**.
 * 같은 페이지의 종료 탭(표)이 이미 6건을 한 화면에 보여주고 있었다는 것이 근거다.
 * PC 는 포스터 그리드 그대로 둔다(index.tsx 의 isMobile 분기).
 *
 * 포스터를 크게 보는 자리는 상세다 — 카드 안 286px 이 아니라 화면 폭(343px)으로 뜬다.
 */

const THUMB_W = 58
/** 800:1122 비율 유지 — 잘라 쓰지 않는다(행사 포스터는 위아래 정보가 다 의미가 있다) */
const THUMB_H = Math.round((THUMB_W * 1122) / 800)

function Row({ e, onOpen }: { e: FabEvent; onOpen: () => void }) {
  const url = e.poster ? `${import.meta.env.BASE_URL}${e.poster}` : undefined
  const reg = regStatus(e.regEnd)
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${e.title} 상세 열기`}
      onClick={onOpen}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        py: 1.25, cursor: 'pointer',
        borderBottom: '1px solid', borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      {/* 썸네일 — 포스터가 없는 행사도 자리는 지킨다(줄 높이가 들쭉날쭉하면 훑기가 안 된다) */}
      <Box
        sx={{
          width: THUMB_W, height: THUMB_H, flexShrink: 0,
          borderRadius: `${radius.chip}px`, overflow: 'hidden',
          bgcolor: 'background.elevated', border: '1px solid', borderColor: 'divider',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {url
          ? <Box component="img" src={url} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <CoPresentIcon sx={{ fontSize: iconSize.feature, color: 'text.disabled' }} />}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <EventCatChip kind={e.kind} />
          <EventStatusChip start={e.start} end={e.end} />
        </Box>
        {/* 제목 2줄까지 — 이 목록에서 가장 중요한 글자라 말줄임을 한 줄로 조이지 않는다 */}
        <Box
          sx={{
            fontSize: typescale.body.size, fontWeight: weight.semibold, lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {e.title}
        </Box>
        {/* 등록 마감 — 갈지 말지 정할 때 필요한 건 행사일이 아니라 이 날짜다(2026-08-13 사용자 요청).
            마감일이 공지 안 된 행사는 아무것도 안 그린다. */}
        {reg && (
          <Box
            component="span"
            sx={(th) => ({
              alignSelf: 'flex-start',
              fontSize: typescale.caption.size, fontWeight: weight.semibold,
              borderRadius: `${radius.chip}px`, px: '6px', py: '1px',
              ...(reg.tone === 'amber'
                ? { color: th.palette.accentText.amber, bgcolor: alpha(th.palette.accent.amber, 0.14) }
                : reg.tone === 'gray'
                  ? { color: 'text.disabled', bgcolor: alpha(th.palette.text.primary, 0.06) }
                  : { color: 'text.secondary', bgcolor: alpha(th.palette.text.primary, 0.06) }),
            })}
          >
            {reg.label}
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, fontSize: typescale.small.size, color: 'text.secondary' }}>
          <Box component="span" sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmtEventDate(e.start, e.end)}</Box>
          {e.venue && (
            <>
              <PlaceOutlinedIcon sx={{ fontSize: iconSize.caption, flexShrink: 0 }} />
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.venue}</Box>
            </>
          )}
        </Box>
      </Box>

      <ChevronRightIcon sx={{ fontSize: iconSize.body, color: 'text.disabled', flexShrink: 0 }} aria-hidden />
    </Box>
  )
}

export default function MobileEventList({ events, onOpen }: { events: FabEvent[]; onOpen: (e: FabEvent) => void }) {
  if (!events.length) {
    return <EmptyState icon={<CoPresentIcon />} title="진행 중이거나 예정된 행사가 없습니다" description="새 행사가 등록되면 여기에 표시됩니다." />
  }
  return (
    <Box sx={{ px: 1.5 }}>
      {events.map((e) => <Row key={e.id} e={e} onOpen={() => onOpen(e)} />)}
    </Box>
  )
}
