import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { radius, typescale, weight } from '@/theme/tokens'

/**
 * 안드로이드형 참석 스위치.
 * 켜짐 = 푸른톤(테마 primary) 배경 + 왼쪽에 '참석' 글자, 손잡이 오른쪽.
 * 꺼짐 = 회색톤 배경 + 오른쪽에 '불참' 글자, 손잡이 왼쪽.
 */
const W = 66
const H = 26
const KNOB = 20
const PAD = 3

export default function AttendSwitch({ checked, disabled, onToggle }: {
  checked: boolean; disabled?: boolean; onToggle: () => void
}) {
  return (
    <Box
      component="button"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? '참석' : '불참'}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle() }}
      sx={(th) => ({
        position: 'relative', width: W, height: H, flex: 'none', p: 0, border: 0,
        borderRadius: `${radius.pill}px`, cursor: disabled ? 'default' : 'pointer',
        bgcolor: checked ? th.palette.primary.main : alpha(th.palette.text.primary, 0.22),
        opacity: disabled ? 0.5 : 1, transition: 'background-color .2s ease',
        display: 'inline-block', verticalAlign: 'middle',
      })}
    >
      {/* 라벨 — 켜짐: 왼쪽 '참석' / 꺼짐: 오른쪽 '불참' */}
      <Box
        component="span"
        sx={(th) => ({
          position: 'absolute', top: 0, height: '100%', display: 'flex', alignItems: 'center',
          fontSize: typescale.caption.size, fontWeight: weight.heavy, letterSpacing: '.02em', lineHeight: 1, pointerEvents: 'none',
          // 꺼짐 트랙은 alpha(text.primary,.22)라 테마에 따라 뒤집힌다(다크 진회색 / 라이트 연회색).
          // 라벨을 흰색으로 고정하면 라이트에서 1.53:1로 사라지므로 text.primary를 쓴다
          // (다크 text.primary=흰색 6.8:1 / 라이트=진남색 10.6:1 — 한 값으로 양쪽 해결).
          ...(checked
            ? { left: 9, color: th.palette.common.white }
            : { right: 9, color: th.palette.text.primary }),
        })}
      >
        {checked ? '참석' : '불참'}
      </Box>
      {/* 손잡이 */}
      <Box
        component="span"
        sx={(th) => ({
          position: 'absolute', top: PAD, width: KNOB, height: KNOB, borderRadius: radius.circle,
          // 라이트 꺼짐 트랙(연회색)에 흰 손잡이는 1.9:1이라 윤곽이 안 잡힌다 — 얇은 테두리로 경계 확보
          bgcolor: th.palette.common.white, border: '1px solid', borderColor: alpha(th.palette.common.black, 0.2),
          boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,.4)', transition: 'left .2s ease',
          left: checked ? W - KNOB - PAD : PAD,
        })}
      />
    </Box>
  )
}
