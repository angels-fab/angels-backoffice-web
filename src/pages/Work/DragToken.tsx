import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { TOKEN_SIZE } from './dropZones'

interface Props {
  /** 업무구분 칩 */
  cat?: string
  /** 축약 표시할 업무명(3줄 클램프) */
  title: string
  /** 드래그 중인 카드 수 — 2장 이상이면 뒤 겹침 레이어 + N건 배지 */
  count: number
  /** 휴지통 위 — 붉은 경고 톤 */
  danger?: boolean
}

/**
 * 드래그 정사각 토큰(시안 docs/mockups/work-drag-trash.html) — 업무구분·축약 업무명만 담은
 * 최소 정보 카드. 2배(180px)로 그리고 부모 래퍼가 0.5 스케일로 표시(고정 축소율 50%).
 * 위치·스케일·페이드는 부모(fixed 래퍼)가 관리한다.
 */
export default function DragToken({ cat, title, count, danger = false }: Props) {
  return (
    <Box
      sx={(th) => ({
        position: 'relative',
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        filter: 'drop-shadow(0 20px 28px rgba(0,0,0,.48))',
        '& .tk-back, & .tk-card': {
          position: 'absolute', inset: 0, borderRadius: '25px',
          border: '1px solid',
          borderColor: danger ? alpha(th.palette.error.main, 0.95) : alpha(th.palette.text.secondary, 0.4),
          background: danger ? '#302024' : 'linear-gradient(145deg, #202b39, #18202b)',
        },
      })}
    >
      {count > 2 && <Box className="tk-back" sx={{ transform: 'translate(28px, 28px) rotate(5deg)', opacity: 0.46 }} />}
      {count > 1 && <Box className="tk-back" sx={{ transform: 'translate(14px, 14px) rotate(2.5deg)', opacity: 0.72 }} />}
      <Box className="tk-card" sx={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%', p: '25px 22px', gap: '12px',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
          }}
        >
          {cat && (
            <Box sx={(th) => ({ px: '10px', py: '5px', borderRadius: '999px', bgcolor: alpha(th.palette.accent.blue, 0.15), color: '#9bcaff', fontSize: 18, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap' })}>
              {cat}
            </Box>
          )}
          <Box
            component="strong"
            sx={{
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              fontSize: 23, lineHeight: 1.28, letterSpacing: '-.03em', fontWeight: 700, wordBreak: 'break-word',
            }}
          >
            {title}
          </Box>
          <Box sx={{ color: 'text.secondary', fontSize: 17, lineHeight: 1 }}>{count > 1 ? '선택 업무 묶음' : '업무카드'}</Box>
        </Box>
      </Box>
      {count > 1 && (
        <Box
          sx={(th) => ({
            position: 'absolute', zIndex: 3, right: -14, top: -14,
            minWidth: 44, height: 30, px: '10px', borderRadius: '999px',
            bgcolor: th.palette.accent.blue, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, lineHeight: 1, boxShadow: '0 7px 18px rgba(0,0,0,.32)',
          })}
        >
          {count}건
        </Box>
      )}
    </Box>
  )
}
