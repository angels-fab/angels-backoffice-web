import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { iconSize, radius, typescale } from '@/theme/tokens'

/** 스와이프 트레이의 상태 변경 옵션(유효 존만) */
export interface SwipeStatusOption {
  key: string
  label: string
  onPress: () => void
}

export interface SwipeableCardProps {
  children: React.ReactNode
  /** 스와이프 활성(관리자·순서편집 아님). false면 자식만 통과(그리드 드래그가 담당) */
  enabled: boolean
  /** 열림 상태 — 그리드가 소유(한 번에 한 카드만 열리게) */
  open: boolean
  /** 열림/닫힘 요청 */
  onOpenChange: (open: boolean) => void
  /** '상태 변경' 대상(유효 존). 비었으면 상태 버튼 숨김 */
  statusOptions: SwipeStatusOption[]
  onEdit: () => void
  onDelete: () => void
}

/** 그리드가 카드별 스와이프 액션을 만들어 넘기는 설정 */
export interface WorkSwipeConfig {
  /** 스와이프 활성(관리자·모바일). false면 그리드가 SwipeableCard로 감싸지 않음 */
  enabled: boolean
  /** num으로 그 카드의 상태옵션·수정·삭제 액션을 만든다 */
  buildActions: (num: string) => Pick<SwipeableCardProps, 'statusOptions' | 'onEdit' | 'onDelete'>
}

const BTN_W = 72 // 트레이 버튼 하나 폭(px)
const AXIS_LOCK = 6 // 축(가로/세로) 판정 임계 이동(px)
const OPEN_RATIO = 0.4 // 이 비율 이상 열면 스냅 오픈
const TRANSITION = 'transform .22s cubic-bezier(.22, 1, 0.36, 1)'
const DANGER = 'error.main'

/**
 * 모바일 업무 카드 왼쪽 스와이프 → 오른쪽에 [상태][수정][삭제] 액션 트레이.
 * - 터치 전용(마우스는 통과 → 그리드 PC 드래그·카드 클릭이 담당).
 * - 축 잠금: 가로 우세일 때만 스와이프, 세로 우세면 페이지 스크롤에 양보.
 * - [상태]는 카드 위 인라인 피커(Drawer/Menu 미사용 = iOS 포커스 튐 없음).
 * - open은 부모가 소유해 한 번에 한 카드만 열림. enabled=false(순서편집)면 자식만 통과.
 */
export default function SwipeableCard({
  children, enabled, open, onOpenChange, statusOptions, onEdit, onDelete,
}: SwipeableCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [statusExpanded, setStatusExpanded] = useState(false)

  const hasStatus = statusOptions.length > 0
  const btnCount = (hasStatus ? 1 : 0) + 2 // 상태? + 수정 + 삭제
  const maxOpen = btnCount * BTN_W

  // 제스처 상태(렌더 유발 없이 ref로)
  const g = useRef({ active: false, axis: 'none' as 'none' | 'h' | 'v', startX: 0, startY: 0, tx0: 0, tx: 0 })

  const setTx = (tx: number, animate: boolean) => {
    const el = cardRef.current
    if (el) {
      el.style.transition = animate ? TRANSITION : 'none'
      el.style.transform = tx === 0 ? '' : `translateX(${tx}px)`
    }
    if (trayRef.current) trayRef.current.style.opacity = String(Math.min(1, Math.abs(tx) / maxOpen))
    g.current.tx = tx
  }

  // 외부에서 open이 바뀌면(다른 카드 열림 등) 정착 위치로 애니메이션
  useEffect(() => {
    if (g.current.active) return
    setTx(open ? -maxOpen : 0, true)
    if (!open) setStatusExpanded(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, maxOpen])

  const cleanup = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onCancel)
    const el = cardRef.current
    if (el) { el.style.userSelect = ''; (el.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '' }
  }

  const onMove = (e: PointerEvent) => {
    const s = g.current
    if (!s.active) return
    const dx = e.clientX - s.startX
    const dy = e.clientY - s.startY
    if (s.axis === 'none') {
      if (Math.hypot(dx, dy) < AXIS_LOCK) return
      if (Math.abs(dx) > Math.abs(dy)) {
        s.axis = 'h'
        setDragging(true)
        const el = cardRef.current
        if (el) { el.style.userSelect = 'none'; (el.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none' }
      } else {
        // 세로 우세 = 스크롤 — 제스처 포기(페이지 스크롤에 양보)
        s.active = false
        cleanup()
        return
      }
    }
    if (s.axis === 'h') {
      e.preventDefault()
      let tx = s.tx0 + dx
      tx = Math.min(0, Math.max(-maxOpen * 1.08, tx)) // 0~ -max, 살짝 오버드래그 허용
      setTx(tx, false)
    }
  }

  const onEnd = () => {
    const s = g.current
    if (!s.active) return
    s.active = false
    cleanup()
    if (s.axis === 'h') {
      setDragging(false)
      const shouldOpen = Math.abs(s.tx) > maxOpen * OPEN_RATIO
      setTx(shouldOpen ? -maxOpen : 0, true)
      onOpenChange(shouldOpen)
      if (!shouldOpen) setStatusExpanded(false)
      // 스와이프 후 뒤따르는 카드 클릭은 무해(카드 탭=무동작) — 별도 억제 불필요
    } else if (open) {
      // 탭(이동 없음): 열려 있으면 닫는다(트레이 버튼 탭은 이 핸들러에 안 옴 — 버튼이 자체 처리)
      setTx(0, true)
      onOpenChange(false)
      setStatusExpanded(false)
    }
    s.axis = 'none'
  }

  const onCancel = () => {
    const s = g.current
    if (!s.active) return
    s.active = false
    cleanup()
    setDragging(false)
    setTx(open ? -maxOpen : 0, true)
    s.axis = 'none'
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return
    if (e.pointerType !== 'touch') return // 마우스는 통과(그리드/카드가 처리)
    if ((e.target as HTMLElement).closest('a, button')) return // 링크·트레이 버튼은 제외
    const s = g.current
    s.active = true
    s.axis = 'none'
    s.startX = e.clientX
    s.startY = e.clientY
    s.tx0 = open ? -maxOpen : 0
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onCancel)
  }

  const closeAll = () => { onOpenChange(false); setStatusExpanded(false) }

  // 비활성(순서편집 등): 자식만 그대로 — 그리드의 reorder 드래그가 담당
  if (!enabled) return <>{children}</>

  return (
    <Box sx={{ position: 'relative', borderRadius: `${radius.card}px`, overflow: 'hidden', minWidth: 0, height: '100%' }}>
      {/* 트레이(카드 뒤) — 오른쪽에 고정, 카드가 밀리면 드러남 */}
      <Box
        ref={trayRef}
        aria-hidden={!open}
        sx={{
          position: 'absolute', top: 0, bottom: 0, right: 0,
          width: maxOpen, display: 'flex', opacity: 0,
        }}
      >
        {hasStatus && (
          <TrayButton label="상태" color="primary.main" onClick={() => setStatusExpanded(true)}>
            <SwapHorizIcon sx={{ fontSize: iconSize.header }} />
          </TrayButton>
        )}
        <TrayButton label="수정" color="#5b6472" onClick={() => { closeAll(); onEdit() }}>
          <EditIcon sx={{ fontSize: iconSize.header }} />
        </TrayButton>
        <TrayButton label="삭제" color={DANGER} onClick={() => { closeAll(); onDelete() }}>
          <DeleteOutlineIcon sx={{ fontSize: iconSize.header }} />
        </TrayButton>
      </Box>

      {/* 카드(슬라이드 레이어) */}
      <Box
        ref={cardRef}
        onPointerDown={onPointerDown}
        sx={{
          position: 'relative', touchAction: 'pan-y', height: '100%',
          '& > *:first-of-type': { height: '100%' },
          transition: dragging ? 'none' : TRANSITION,
          WebkitTouchCallout: 'none',
        }}
      >
        {children}
      </Box>

      {/* [상태] 인라인 피커 오버레이 — 카드 위, Drawer/Menu 미사용(iOS 포커스 튐 없음) */}
      {open && statusExpanded && (
        <Box
          sx={{
            position: 'absolute', inset: 0, zIndex: 2,
            bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`,
            display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 1,
            overflowX: 'auto',
          }}
        >
          <ButtonBase
            onClick={() => setStatusExpanded(false)}
            aria-label="뒤로"
            sx={{ flexShrink: 0, width: 34, height: 34, borderRadius: radius.circle, color: 'text.secondary' }}
          >
            <ArrowBackIcon sx={{ fontSize: iconSize.header }} />
          </ButtonBase>
          {statusOptions.map((o) => (
            <ButtonBase
              key={o.key}
              onClick={() => { o.onPress(); closeAll() }}
              sx={{
                flexShrink: 0, px: 1.75, height: 34, borderRadius: radius.pill,
                bgcolor: 'action.hover', color: 'text.primary', fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight,
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </ButtonBase>
          ))}
        </Box>
      )}
    </Box>
  )
}

function TrayButton({ label, color, onClick, children }: { label: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={{
        flex: 1, minWidth: 0, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.25,
        bgcolor: color, color: 'common.white',
      }}
    >
      {children}
      <Typography component="span" sx={{ fontSize: typescale.caption.size, fontWeight: 700, lineHeight: 1 }}>{label}</Typography>
    </ButtonBase>
  )
}
