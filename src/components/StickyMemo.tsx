import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import PushPinIcon from '@mui/icons-material/PushPin'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLessOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import SendIcon from '@mui/icons-material/SendRounded'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import { RichBodyEditor } from '@/components/richText'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { addReply } from '@/store/slices/replySlice'
import { putSetting } from '@/store/slices/userSettingsSlice'
import { updateImprovement, createReply } from '@/api/improve'
import { useRole } from '@/auth/role'
import { memosForPath } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import { RichBodyView } from '@/utils/richBody'
import { StatusChip, useSnack } from '@/components/ds'
import { impKind, normStatus } from '@/pages/Improve/improveMeta'
import { iconSize, radius, typescale, weight, z } from '@/theme/tokens'
import type { ImprovementItem } from '@/types'
import type { ReplyRow } from '@/api/sheets'

/**
 * 화면 붙임쪽지 — 포털개선요청을 '해당 화면 위'에 띄우는 표시 방식.
 *
 * 게시판 작성 폼이 번거로워 요청이 안 올라오는 문제를 입력 쪽에서 푼 것(상단바 메모 버튼).
 * 데이터는 여전히 improvements 한 곳이라, 상태·이력·통계는 게시판이 그대로 담당한다.
 *
 * 동작 규칙(시안 확정)
 *  - 평소엔 핀 하나로 접힘. 마우스를 올리면 제목이 뜨고, 클릭하면 펼쳐진다.
 *  - 제자리 클릭이면 펼침/접힘 토글, 3px 넘게 움직였으면 '끈 것'이라 토글하지 않는다.
 *  - 접혔든 펼쳤든 어디를 잡아도 끌린다(버튼·입력칸만 예외).
 *  - 좌표는 %로 저장한다. 픽셀로 저장하면 좁은 화면에서 쪽지가 밖으로 나간다.
 *  - 위치는 개인(user_settings), 내용은 공유(improvements) — 남이 옮겨도 내 화면은 안 움직인다.
 *  - PC 전용. 모바일은 좁아서 자유 배치가 스크롤과 싸우기만 하므로 기존 헤더 패널을 그대로 쓴다.
 */

/** 개인 좌표 저장 키(user_settings) — 요청번호 → 레이어 대비 % 좌표 */
const POS_KEY = 'memo.pos'
type Pos = { x: number; y: number }
type PosMap = Record<string, Pos>

/** 상단바 높이 — 레이어 상단 기준(구 index.css body padding-top 53과 같은 값) */
const TOPBAR_H = 53
/** PC 사이드바 레일 폭 — 레이어 좌측 기준(SideNav 64px 레일) */
const RAIL_W = 64
/** 펼친 쪽지 폭 */
const OPEN_W = 300
/** 끌었다고 볼 최소 이동량(px) — 이보다 작으면 '제자리 클릭'으로 본다 */
const DRAG_SLOP = 3

/** 접힌 핀 한 변(px) — 기본 자리를 버튼 중심에 맞출 때 쓴다 */
const PIN = 34
/** 버튼 아래로 띄우는 간격(px) */
const ANCHOR_GAP = 8
/** 슬롯 간격(px) — 핀 한 변 + 여유 6 */
const SLOT = PIN + 6
/** 빈 슬롯 탐색 상한 — 무한루프 방지 */
const MAX_SLOT = 200

/**
 * 슬롯 n의 자리(px, 레이어 기준) — **메모 버튼 바로 아래에서 오른쪽으로 한 줄**.
 * 한 줄이 화면 오른쪽 끝에 닿으면 그다음 줄로 넘어간다.
 * 버튼을 못 찾으면(게시판 핀으로 켠 메모 등) 우상단을 기준점으로 삼는다.
 */
function slotPx(layer: HTMLElement, n: number): { x: number; y: number } {
  const W = layer.clientWidth, H = layer.clientHeight
  const anchor = document.querySelector('[data-memo-anchor]')
  const l = layer.getBoundingClientRect()
  const baseX = anchor
    ? anchor.getBoundingClientRect().left + anchor.getBoundingClientRect().width / 2 - l.left - PIN / 2
    : W - PIN - 16
  const perRow = Math.max(1, Math.floor((W - baseX - PIN) / SLOT) + 1)
  const row = Math.floor(n / perRow), col = n % perRow
  return {
    x: Math.min(Math.max(baseX + col * SLOT, 0), Math.max(W - PIN, 0)),
    y: Math.min(ANCHOR_GAP + row * SLOT, Math.max(H - PIN, 0)),
  }
}

const toPct = (layer: HTMLElement, p: { x: number; y: number }): Pos => ({
  x: +(p.x / layer.clientWidth * 100).toFixed(2),
  y: +(p.y / layer.clientHeight * 100).toFixed(2),
})
const toPx = (layer: HTMLElement, p: Pos) => ({
  x: p.x / 100 * layer.clientWidth,
  y: p.y / 100 * layer.clientHeight,
})
/**
 * 끌기·접기 대상에서 빼야 하는 지점 — 버튼·입력칸, 그리고 리치 에디터(contenteditable).
 * 에디터는 input/textarea 가 아니라서 빠뜨리면 글을 쓰려고 누르는 순간 쪽지가 접히거나 끌린다.
 */
const isInteractive = (el: HTMLElement) => !!el.closest('button, input, textarea, a, [contenteditable]')

/** 이미 다른 쪽지가 차지한 자리인지(핀 한 변 안이면 겹친 것으로 본다) */
const overlaps = (p: { x: number; y: number }, taken: { x: number; y: number }[]) =>
  taken.some((q) => Math.abs(q.x - p.x) < PIN && Math.abs(q.y - p.y) < PIN)

interface NoteProps {
  item: ImprovementItem
  replies: ReplyRow[]
  pos: Pos
  layerRef: React.RefObject<HTMLDivElement | null>
  canEdit: boolean
  user: string | null
  onMoveEnd: (num: string, pos: Pos) => void
}

function StickyNote({ item, replies, pos, layerRef, canEdit, user, onMoveEnd }: NoteProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const elRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  // 쪽지에서 바로 제목·내용 수정 — 게시판까지 가지 않아도 고칠 수 있게(수정 권한은 게시판과 동일)
  const [editing, setEditing] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eContent, setEContent] = useState('')
  const [live, setLive] = useState<Pos>(pos)
  const drag = useRef({ on: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  // 놓는 순간 저장할 좌표는 ref로 따로 들고 간다 — state(live)는 마지막 move가 아직 반영 안 됐을 수 있다
  const latest = useRef<Pos>(pos)
  const place = (p: Pos) => { latest.current = p; setLive(p) }

  // 외부(다른 기기에서 옮긴 위치 등)에서 좌표가 바뀌면 따라간다 — 끄는 중에는 무시
  useEffect(() => { if (!drag.current.on) { latest.current = pos; setLive(pos) } }, [pos])

  /** 커진 만큼(펼침·창 축소) 화면 밖으로 나갔으면 레이어 안으로 되당긴다 */
  const clamp = useCallback((p: Pos): Pos => {
    const layer = layerRef.current, el = elRef.current
    if (!layer || !el) return p
    const W = layer.clientWidth, H = layer.clientHeight
    if (W <= 0 || H <= 0) return p
    const maxX = Math.max(W - el.offsetWidth, 0), maxY = Math.max(H - el.offsetHeight, 0)
    return {
      x: +(Math.min(Math.max(p.x / 100 * W, 0), maxX) / W * 100).toFixed(2),
      y: +(Math.min(Math.max(p.y / 100 * H, 0), maxY) / H * 100).toFixed(2),
    }
  }, [layerRef])

  // 펼치거나 답글이 늘면 높이가 바뀌므로 그 직후 되당김. 창 크기 변경도 같은 처리.
  useEffect(() => {
    const pull = () => place(clamp(latest.current))
    pull()
    window.addEventListener('resize', pull)
    return () => window.removeEventListener('resize', pull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamp, open, replies.length])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractive(e.target as HTMLElement)) return
    const el = elRef.current
    if (!el) return
    drag.current = { on: true, moved: false, sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop }
    try { el.setPointerCapture(e.pointerId) } catch { /* 캡처 실패해도 이동은 동작 */ }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.on) return
    const layer = layerRef.current, el = elRef.current
    if (!layer || !el) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP) d.moved = true
    const W = layer.clientWidth, H = layer.clientHeight
    const px = Math.min(Math.max(d.ox + dx, 0), Math.max(W - el.offsetWidth, 0))
    const py = Math.min(Math.max(d.oy + dy, 0), Math.max(H - el.offsetHeight, 0))
    place({ x: +(px / W * 100).toFixed(2), y: +(py / H * 100).toFixed(2) })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    if (d.moved) { onMoveEnd(item.num, latest.current); return }   // 끌었으면 위치만 저장하고 토글하지 않는다
    if (isInteractive(e.target as HTMLElement)) return
    setOpen((o) => !o)                                    // 제자리 클릭 = 펼침/접힘 토글
  }

  const unpin = async () => {
    if (!canEdit) return
    setBusy(true)
    try {
      await updateImprovement({ author: user || '', key: 'session', num: item.num, memo: false })
      snack('쪽지를 뗐습니다. 요청은 게시판에 그대로 있습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '쪽지 떼기에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    setETitle(item.title || '')
    setEContent(item.content || '')
    setEditing(true)
  }

  const saveEdit = async () => {
    const t = eTitle.trim()
    if (!t) return snack('제목을 입력해주세요.', 'error')
    setBusy(true)
    try {
      await updateImprovement({ author: user || '', key: 'session', num: item.num, title: t, content: eContent })
      setEditing(false)
      snack('수정했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '수정에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendReply = async () => {
    const v = reply.trim()
    if (!v || !user || busy) return
    setBusy(true)
    try {
      const { id, created } = await createReply({ author: user, key: 'session', reqNum: item.num, content: v })
      dispatch(addReply({ id, reqNum: item.num, created: created || `${todaySeoul()} 00:00:00`, author: user, content: v, edited: '' }))
      setReply('')
      snack('답글을 등록했습니다.', 'success')
    } catch (err) {
      snack(err instanceof Error ? err.message : '답글 등록에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const st = normStatus(item.status)
  const folded = (
    // 압정은 글자가 아니라 그림이므로 채움 토큰(accent.amber)을 쓴다.
    // 글자용 accentText.amber 는 라이트에서 #7F5B00(갈색)이라 압정이 갈색으로 보였다.
    // 게시판 '작업 메모' 열의 켜진 핀과 같은 값 — 두 화면의 같은 표시는 같은 색이어야 한다.
    <Box sx={(th) => ({ display: 'grid', placeItems: 'center', width: 34, height: 34, color: th.palette.accent.amber })}>
      <PushPinIcon sx={{ fontSize: iconSize.header }} />
    </Box>
  )

  const note = (
    <Box
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current.on = false }}
      sx={(th) => ({
        position: 'absolute',
        left: `${live.x}%`,
        top: `${live.y}%`,
        width: open ? OPEN_W : 'auto',
        // 펼친 쪽지는 항상 맨 위 — 안 그러면 DOM 순서상 뒤에 오는 압정들이 본문을 덮는다
        // (요청번호 순으로 그려지므로 번호가 큰 쪽지가 위로 올라온다). 집는 중인 것도 위로.
        zIndex: open ? 3 : 1,
        pointerEvents: 'auto',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(th.palette.accent.amber, 0.5)}`,
        borderRadius: `${radius.card}px`,
        boxShadow: th.shadows[8],
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': { borderColor: th.palette.accent.amber, zIndex: 2 },
        '&:active': { cursor: 'grabbing', zIndex: 4 },
        '& input': { cursor: 'text', userSelect: 'text' },
      })}
    >
      {!open ? folded : (
        <>
          <Box
            sx={(th) => ({
              display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 1,
              borderBottom: '1px solid', borderColor: 'divider',
              borderRadius: `${radius.card}px ${radius.card}px 0 0`,
              background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.13)}, transparent 70%)`,
            })}
          >
            <PushPinIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
            <Box component="span" sx={(th) => ({ fontSize: typescale.caption.size, fontWeight: weight.heavy, color: th.palette.accentText.amber, fontVariantNumeric: 'tabular-nums' })}>
              요청 #{item.num}
            </Box>
            <StatusChip status={impKind(st)} label={st || '-'} />
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
              {canEdit && !editing && (
                <Tooltip title="제목·내용 수정">
                  <IconButton size="small" aria-label="메모 수정" onClick={startEdit} sx={{ color: 'text.secondary', p: 0.5 }}>
                    <EditIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="접기">
                <IconButton size="small" aria-label="쪽지 접기" onClick={() => setOpen(false)} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <UnfoldLessIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Tooltip>
              {canEdit && (
                <Tooltip title="쪽지 떼기 (요청은 게시판에 남습니다)">
                  <IconButton size="small" aria-label="쪽지 떼기" onClick={unpin} disabled={busy} sx={{ color: 'text.secondary', p: 0.5 }}>
                    <DeleteOutlineIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>
            {editing ? (
              /* 수정 — 게시판까지 가지 않고 여기서 바로. 본문은 게시판과 같은 리치 에디터라
                 서식이 있는 글을 열어도 깨지지 않는다(평문 textarea 로 받으면 태그가 드러난다). */
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  autoFocus
                  value={eTitle}
                  onChange={(e) => setETitle(e.target.value)}
                  placeholder="제목"
                  disabled={busy}
                  slotProps={{ htmlInput: { maxLength: 60, 'aria-label': '메모 제목' } }}
                  sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size, py: 0.75 } }}
                />
                <RichBodyEditor
                  value={eContent}
                  onChange={setEContent}
                  placeholder="내용"
                  ariaLabel="메모 내용"
                  fontSize={typescale.small.size}
                  minHeight={64}
                  framed
                  onCtrlEnter={() => void saveEdit()}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <Button size="small" onClick={() => setEditing(false)} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
                  <Button size="small" variant="contained" onClick={saveEdit} disabled={busy || !eTitle.trim()}>
                    {busy ? '저장 중…' : '저장'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <>
                <Box sx={{ fontSize: typescale.body.size, fontWeight: weight.heavy, color: 'text.primary', lineHeight: 1.45, mb: 0.5 }}>
                  {item.title}
                </Box>
                {item.content && (
                  <RichBodyView html={item.content} sx={{ fontSize: typescale.small.size, lineHeight: 1.65, color: 'text.secondary', maxHeight: 168, overflowY: 'auto' }} />
                )}
              </>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: 'text.secondary' }}>
                <PersonOutlineIcon sx={{ fontSize: iconSize.caption }} />{item.author || '-'}
              </Box>
              <Box
                component="span"
                sx={(th) => ({
                  fontSize: typescale.caption.size, color: 'accentText.blue',
                  bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: `${radius.pill}px`,
                })}
              >
                {item.loc || '-'}
              </Box>
              <Button
                size="small"
                endIcon={<OpenInNewIcon sx={{ fontSize: iconSize.caption }} />}
                onClick={() => navigate('/improve')}
                sx={{ ml: 'auto', minWidth: 0, px: 0.75, fontSize: typescale.caption.size, color: 'text.secondary' }}
              >
                게시판
              </Button>
            </Box>

            {replies.length > 0 && (
              <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 132, overflowY: 'auto' }}>
                {replies.map((r) => (
                  <Box key={r.id} sx={{ bgcolor: 'background.elevated', borderRadius: `${radius.chip}px`, px: 1, py: 0.75 }}>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: 'text.primary', mr: 0.75 }}>
                      {r.author || '-'}
                    </Box>
                    <RichBodyView html={r.content} sx={{ display: 'inline', fontSize: typescale.caption.size, color: 'text.secondary' }} />
                  </Box>
                ))}
              </Box>
            )}

            {canEdit && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendReply() } }}
                  placeholder="답글 달기"
                  disabled={busy}
                  slotProps={{ htmlInput: { 'aria-label': '답글 입력' } }}
                  sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size, py: 0.75 } }}
                />
                <IconButton
                  size="small"
                  aria-label="답글 등록"
                  onClick={sendReply}
                  disabled={busy || !reply.trim()}
                  sx={{ flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
                >
                  <SendIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  )

  // 접힘 상태는 핀만 보이므로 무슨 요청인지 알 수 없다 — 마우스를 올리면 제목이 뜬다
  return open ? note : <Tooltip title={`#${item.num} ${item.title}`} placement="left">{note}</Tooltip>
}

/**
 * 현재 경로의 붙임쪽지 레이어. 상단바·사이드바를 뺀 콘텐츠 영역 위에 고정으로 떠 있다.
 * 쪽지가 없거나 게스트·모바일이면 아무것도 렌더하지 않는다.
 */
export default function StickyMemoLayer() {
  const { pathname } = useLocation()
  const { isMember, isAdmin, user, authKey } = useRole()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('shell'))
  const dispatch = useAppDispatch()
  // 레이어는 ref(자식의 clamp용)와 state(기본 자리 재계산 트리거) 둘 다로 잡는다.
  // 예전에는 boolean 플래그로 '측정했음'을 표시했는데, 이 레이어는 MainLayout에 있어
  // 메모 없는 페이지로 가면 언마운트된다. 그때 ref는 null이 되는데 플래그는 true로 남아서,
  // 그 페이지에서 첫 메모를 만들면 재계산이 안 걸리고 폴백 자리에 그대로 붙어 있었다
  // (새로고침하면 플래그가 초기화돼 정상 — 2026-08-05 사용자 신고). state로 두면
  // 마운트·언마운트마다 값이 바뀌므로 매번 정확히 한 번 다시 계산된다.
  const layerRef = useRef<HTMLDivElement | null>(null)
  const [layerEl, setLayerEl] = useState<HTMLDivElement | null>(null)
  const attachLayer = useCallback((el: HTMLDivElement | null) => {
    layerRef.current = el
    setLayerEl(el)
  }, [])

  const items = useAppSelector((s) => s.improve.items)
  const replyItems = useAppSelector((s) => s.reply.items)
  const saved = useAppSelector((s) => s.userSettings.settings[POS_KEY]) as PosMap | undefined

  const memos = useMemo(() => memosForPath(items, pathname), [items, pathname])
  const repliesByReq = useMemo(() => {
    const m: Record<string, ReplyRow[]> = {}
    for (const r of replyItems) (m[r.reqNum] ||= []).push(r)
    for (const k in m) m[k].sort((a, b) => a.created.localeCompare(b.created))
    return m
  }, [replyItems])

  /**
   * 자리가 없는 쪽지에 **빈 슬롯을 배정하고 즉시 저장**한다.
   *
   * 예전에는 목록에서의 순번(index)으로 자리를 계산했다. 그러면 앞의 쪽지를 하나 떼는
   * 순간 뒤 쪽지들의 순번이 당겨져 자리가 우르르 이동했다(2026-08-05 사용자 신고:
   * "몇 개 삭제하면 주변 압정들이 그 자리를 채우듯 이동"). 한 번 정해진 자리는 본인이
   * 옮기기 전엔 고정이어야 하므로, 배정하는 순간 좌표로 굳혀 둔다.
   *
   * 빈 슬롯 = 이미 다른 쪽지가 있는 자리를 건너뛴 첫 자리. 그래서 떼어낸 자리는
   * 다음에 만드는 쪽지가 자연스럽게 다시 쓴다.
   */
  useEffect(() => {
    if (!layerEl || memos.length === 0) return
    const need = memos.filter((t) => !saved?.[t.num])
    if (need.length === 0) return
    const taken = memos.filter((t) => saved?.[t.num]).map((t) => toPx(layerEl, saved![t.num]))
    const patch: PosMap = {}
    for (const t of need) {
      let n = 0
      while (n < MAX_SLOT && overlaps(slotPx(layerEl, n), taken)) n++
      const px = slotPx(layerEl, n)
      taken.push(px)
      patch[t.num] = toPct(layerEl, px)
    }
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), ...patch } }))
  }, [layerEl, memos, saved, dispatch])

  // 옮긴 위치는 개인 설정에 저장(디바운스 병합) — 다른 사람 화면은 움직이지 않는다
  const onMoveEnd = useCallback((num: string, pos: Pos) => {
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), [num]: pos } }))
  }, [dispatch, saved])

  if (!isMember || !isDesktop || memos.length === 0) return null

  return (
    <Box
      ref={attachLayer}
      aria-label="화면 메모"
      sx={{
        position: 'fixed',
        top: `${TOPBAR_H}px`,
        left: `${RAIL_W}px`,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',   // 레이어 자체는 클릭을 통과시키고, 쪽지만 받는다
        zIndex: z.stickyMemo,
      }}
    >
      {memos.map((t) => {
        // 자리가 아직 없으면 이번 프레임만 건너뛴다 — 위 useEffect가 곧바로 배정한다.
        // 임시 자리에 그렸다가 옮기면 쪽지가 튀어 보인다.
        const pos = saved?.[t.num]
        if (!pos) return null
        return (
          <StickyNote
            key={t.num}
            item={t}
            replies={repliesByReq[t.num] || []}
            pos={pos}
            layerRef={layerRef}
            canEdit={isAdmin && !!user && !!authKey}
            user={user}
            onMoveEnd={onMoveEnd}
          />
        )
      })}
    </Box>
  )
}
