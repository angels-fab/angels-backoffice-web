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
import { updateImprovement, createReply, deleteImprovement, createImprovement } from '@/api/improve'
import type { MemoStroke } from '@/api/improve'
import MemoDraw, { pointsOf, INK, MEMO_DRAW_EVENT } from '@/components/MemoDraw'
import GestureIcon from '@mui/icons-material/Gesture'
import { useRole } from '@/auth/role'
import { memosForPath, visibleMemos, pathToLocation, firstLine } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import { RichBodyView } from '@/utils/richBody'
import ButtonBase from '@mui/material/ButtonBase'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { StatusChip, useSnack, ConfirmDialog } from '@/components/ds'
import { IMP_STATUSES, impKind, isSettled, needsReason, normStatus } from '@/pages/Improve/improveMeta'
import { iconSize, layout, radius, shadow, typescale, weight, z } from '@/theme/tokens'
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
 *  - 좌표는 **본문 칸 좌상단 기준 px**으로 저장한다(아래 POS_KEY 주석).
 *  - 위치는 개인(user_settings), 내용은 공유(improvements) — 남이 옮겨도 내 화면은 안 움직인다.
 *  - PC 전용. 모바일은 좁아서 자유 배치가 스크롤과 싸우기만 하므로 기존 헤더 패널을 그대로 쓴다.
 */

/**
 * 개인 좌표 저장 키(user_settings) — 요청번호 → **본문 칸 좌상단 기준 px** 좌표.
 *
 * v1(`memo.pos`)은 '사이드바 오른쪽 끝 ~ 화면 오른쪽 끝' 전체를 100%로 본 비율이었다.
 * 본문은 가운데 정렬 + 최대 1400이라 같이 넓어지지 않으므로, 해상도가 바뀌면 같은 %가
 * 표에서 한참 떨어진 여백에 찍혔다(2026-08-05 사용자 신고: "화면에 따라 다른 곳에 고정돼 보인다").
 * 그래서 기준을 본문 칸으로 옮기고 단위도 px으로 바꿨다 — 표는 폭·행 높이가 고정이라
 * 비율보다 px이 '표의 그 지점 옆'을 그대로 지킨다. 기준이 달라 v1 값은 이어 쓸 수 없어 키를 새로 뒀다
 * (v1 좌표를 가진 쪽지는 기본 자리로 한 번 돌아가고, 다시 옮기면 그 자리에 굳는다).
 */
const POS_KEY = 'memo.pos2'
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
 * 슬롯 n의 자리(px, 본문 칸 기준) — **메모 버튼 바로 아래에서 오른쪽으로 한 줄**.
 * 한 줄이 본문 칸 오른쪽 끝에 닿으면 그다음 줄로 넘어간다.
 * 버튼을 못 찾으면(게시판 핀으로 켠 메모 등) 우상단을 기준점으로 삼는다.
 * 넓은 화면에서는 버튼(상단바 오른쪽 끝)이 본문 칸보다 바깥이라 오른쪽 끝으로 붙는다.
 */
function slotPx(layer: HTMLElement, n: number): { x: number; y: number } {
  const H = layer.clientHeight
  const outerW = layer.parentElement?.clientWidth ?? layer.clientWidth
  const side = Math.max(0, (outerW - layer.clientWidth) / 2)
  const minX = -side                                  // 왼쪽 여백 끝
  const maxX = layer.clientWidth + side - PIN         // 오른쪽 여백 끝
  const anchor = document.querySelector('[data-memo-anchor]')
  const l = layer.getBoundingClientRect()
  const baseX = anchor
    ? anchor.getBoundingClientRect().left + anchor.getBoundingClientRect().width / 2 - l.left - PIN / 2
    : maxX - 16
  const perRow = Math.max(1, Math.floor((maxX - baseX) / SLOT) + 1)
  const row = Math.floor(n / perRow), col = n % perRow
  return {
    x: Math.min(Math.max(baseX + col * SLOT, minX), Math.max(maxX, minX)),
    y: Math.min(ANCHOR_GAP + row * SLOT, Math.max(H - PIN, 0)),
  }
}

/**
 * 끌 수 있는 범위 — **좌표 기준은 본문 칸이지만 이동은 화면 전체**(사용자 요청 2026-08-05).
 *
 * 기준을 본문 칸으로 옮기면서 이동까지 본문 폭으로 가둬 버려서, 넓은 화면의 좌우 여백에 쪽지를
 * 둘 수 없었다. 기준(원점)과 범위는 별개 문제다 — 원점은 본문 좌상단으로 유지해야 해상도가 바뀌어도
 * 표의 같은 지점 옆에 남고, 범위만 넓히면 여백에도 놓을 수 있다. 여백으로 나간 쪽지는 x가 음수이거나
 * 본문 폭을 넘는 값으로 저장된다.
 * 위로도 상단바(로고 줄)까지 올릴 수 있다(minY = -TOPBAR_H, 사용자 요청 2026-08-05).
 * 쪽지 층(z 90)이 상단바(z 50)보다 위라 가려지지 않고, 레이어에 overflow 를 걸지 않아 밖으로 나가도 잘리지 않는다.
 */
function dragBounds(layer: HTMLElement, el: HTMLElement) {
  const outerW = layer.parentElement?.clientWidth ?? layer.clientWidth
  const side = Math.max(0, (outerW - layer.clientWidth) / 2) // 본문 칸 한쪽 여백 폭
  return {
    minX: -side,
    maxX: Math.max(-side, layer.clientWidth + side - el.offsetWidth),
    minY: -TOPBAR_H,
    maxY: Math.max(-TOPBAR_H, layer.clientHeight - el.offsetHeight),
  }
}

/**
 * 끌기·접기 대상에서 빼야 하는 지점 — 버튼·입력칸, 그리고 리치 에디터(contenteditable).
 * 에디터는 input/textarea 가 아니라서 빠뜨리면 글을 쓰려고 누르는 순간 쪽지가 접히거나 끌린다.
 */
// role="combobox" = MUI Select 의 표시부. div 라서 빠뜨리면 상태를 고르려고 누르는 순간 쪽지가 끌린다.
const isInteractive = (el: HTMLElement) => !!el.closest('button, input, textarea, a, [contenteditable], [role="combobox"]')

/** 이미 다른 쪽지가 차지한 자리인지(핀 한 변 안이면 겹친 것으로 본다) */
const overlaps = (p: { x: number; y: number }, taken: { x: number; y: number }[]) =>
  taken.some((q) => Math.abs(q.x - p.x) < PIN && Math.abs(q.y - p.y) < PIN)

interface NoteProps {
  item: ImprovementItem
  replies: ReplyRow[]
  pos: Pos
  layerRef: React.RefObject<HTMLDivElement | null>
  canEdit: boolean
  /** 요청 자체를 지울 수 있는가 — 게시판과 같은 규칙(담당자 본인 또는 포털 관리자) */
  canDelete: boolean
  /** 화면에 그림을 그릴 수 있는가 — 포털 관리자 전용 편의 도구(2026-08-05) */
  canDraw: boolean
  user: string | null
  onMoveEnd: (num: string, pos: Pos) => void
  /** 이 쪽지에 그림 그리기 시작 — 판은 레이어가 띄운다 */
  onDraw: (num: string) => void
}

function StickyNote({ item, replies, pos, layerRef, canEdit, canDelete, canDraw, user, onMoveEnd, onDraw }: NoteProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const elRef = useRef<HTMLDivElement>(null)
  // 상태 메뉴 기준점은 ref 로 잡는다 — 클릭 시점의 currentTarget 을 state 에 담아 두면
  // 쪽지가 다시 그려질 때 그 노드가 떨어져 나가 메뉴가 화면 좌상단(0,0)에 뜬다(2026-08-05 사용자 신고).
  // 상단바 메모 버튼(MemoComposeButton)도 같은 이유로 ref 방식을 쓴다.
  const stBtnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  // 쪽지에서 바로 제목·내용 수정 — 게시판까지 가지 않아도 고칠 수 있게(수정 권한은 게시판과 동일)
  const [editing, setEditing] = useState(false)
  const [eContent, setEContent] = useState('')
  const [stOpen, setStOpen] = useState(false)                                        // 상태 메뉴 열림
  const [delAsk, setDelAsk] = useState(false)                                        // 요청 삭제 확인
  const [statusAsk, setStatusAsk] = useState<{ status: string; reason: string } | null>(null) // 종결 확인(+사유)
  const [live, setLive] = useState<Pos>(pos)
  const drag = useRef({ on: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  // 놓는 순간 저장할 좌표는 ref로 따로 들고 간다 — state(live)는 마지막 move가 아직 반영 안 됐을 수 있다
  const latest = useRef<Pos>(pos)
  const place = (p: Pos) => { latest.current = p; setLive(p) }

  // 외부(다른 기기에서 옮긴 위치 등)에서 좌표가 바뀌면 따라간다 — 끄는 중에는 무시
  useEffect(() => { if (!drag.current.on) { latest.current = pos; setLive(pos) } }, [pos])

  /** 커진 만큼(펼침·창 축소) 화면 밖으로 나갔으면 되당긴다 — 여백은 허용, 화면 밖은 불가 */
  const clamp = useCallback((p: Pos): Pos => {
    const layer = layerRef.current, el = elRef.current
    if (!layer || !el) return p
    if (layer.clientWidth <= 0 || layer.clientHeight <= 0) return p
    const b = dragBounds(layer, el)
    return {
      x: Math.min(Math.max(p.x, b.minX), b.maxX),
      y: Math.min(Math.max(p.y, b.minY), b.maxY),
    }
  }, [layerRef])

  /**
   * 펼치거나 답글이 늘면 높이가 바뀌므로 그 직후 되당김. 창 크기 변경도 같은 처리.
   *
   * 되당길 때 기준은 **항상 저장된 좌표(pos)** 다. 화면에 보이는 값(latest)을 기준으로 삼으면
   * 창을 좁혔다 넓힐 때 좁은 화면에서 당겨진 자리가 그대로 굳어 가운데에 남는다
   * (2026-08-05 사용자 신고). 저장값은 그대로 두고 화면 표시만 접었다 펴는 방식이라
   * 창을 다시 넓히면 원래 자리로 정확히 돌아온다.
   */
  useEffect(() => {
    const pull = () => { if (!drag.current.on) place(clamp(pos)) }
    pull()
    window.addEventListener('resize', pull)
    return () => window.removeEventListener('resize', pull)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamp, open, replies.length, pos])

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
    const b = dragBounds(layer, el)
    place({
      x: Math.min(Math.max(d.ox + dx, b.minX), b.maxX),
      y: Math.min(Math.max(d.oy + dy, b.minY), b.maxY),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.on) return
    d.on = false
    if (d.moved) { onMoveEnd(item.num, latest.current); return }   // 끌었으면 위치만 저장하고 토글하지 않는다
    if (isInteractive(e.target as HTMLElement)) return
    setOpen((o) => !o)                                    // 제자리 클릭 = 펼침/접힘 토글
  }

  /**
   * 요청 삭제 — 쪽지만이 아니라 **게시판에서도 지운다**(사용자 확정 2026-08-05).
   *
   * 예전의 '쪽지 떼기'(memo=false)는 없앴다. 쪽지만 치우고 싶으면 상태를 보류·완료·불가로 바꾸면 되는데,
   * 그때 DB(improve_update)가 memo 를 자동으로 끄기 때문이다 — 두 갈래가 한 곳으로 정리된다.
   */
  const removeRequest = async () => {
    if (!canDelete || !user) return
    setBusy(true)
    try {
      await deleteImprovement({ author: user, key: 'session', num: item.num })
      setDelAsk(false)
      snack(`요청 #${item.num}을 삭제했습니다.`, 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  /**
   * 상태 변경 — 게시판과 같은 값·확인 규칙.
   * 보류·완료·불가로 바꾸면 DB가 memo 를 자동으로 꺼서 **쪽지만 사라지고 요청은 게시판에 남는다**.
   * memo 를 같이 보내면 그 자동 규칙을 덮어쓰므로, 여기서는 status·reason 만 보낸다.
   */
  const saveStatus = async (status: string, reason: string) => {
    if (!canEdit || !user) return
    setBusy(true)
    try {
      await updateImprovement({ author: user, key: 'session', num: item.num, status, reason })
      setStatusAsk(null)
      snack(isSettled(status) ? `상태를 '${status}'로 바꿨습니다. 쪽지는 내려가고 요청은 게시판에 남습니다.` : '상태를 변경했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '상태 변경에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }
  // 종결(보류·완료·불가)은 확인 한 단계 — 보류·불가는 사유까지 받는다(게시판과 동일)
  const onStatusPick = (next: string) => {
    if (next === st) return
    if (isSettled(next)) setStatusAsk({ status: next, reason: item.reason || '' })
    else void saveStatus(next, '')
  }

  const startEdit = () => {
    setEContent(item.content || item.title || '')
    setEditing(true)
  }

  const saveEdit = async () => {
    const body = eContent.trim()
    if (!body) return snack('내용을 입력해주세요.', 'error')
    setBusy(true)
    try {
      // 게시판 제목은 내용 첫 줄에서 다시 만든다 — 내용을 고치면 목록 제목도 따라 바뀐다
      await updateImprovement({ author: user || '', key: 'session', num: item.num, title: firstLine(body), content: body })
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
        left: `${live.x}px`,
        top: `${live.y}px`,
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
        // 화면 위에 떠 있는 쪽지(드래그 이동) — 카드가 아니라 부유 표면이라 lg
        boxShadow: shadow.lg,
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
            {/* 상태 — 게시판과 같은 값·색. 종결로 바꾸면 쪽지는 내려가고 요청은 게시판에 남는다.
                MUI Select 를 쓰면 드롭다운 화살표가 칩 글자를 덮어(2026-08-05 사용자 신고) 칩 자체를
                버튼으로 삼고 Menu 를 띄운다. 버튼이라 끌기 판정(isInteractive)에서도 자동으로 빠진다. */}
            {canEdit ? (
              <ButtonBase
                ref={stBtnRef}
                onClick={() => setStOpen(true)}
                disabled={busy}
                aria-label={`상태 변경 (현재 ${st || '-'})`}
                sx={{ borderRadius: `${radius.pill}px` }}
              >
                <StatusChip status={impKind(st)} label={st || '-'} />
              </ButtonBase>
            ) : (
              <StatusChip status={impKind(st)} label={st || '-'} />
            )}
            {/* 순서: 접기 · 수정 · 삭제 (사용자 지시 2026-08-05) */}
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
              <Tooltip title="접기">
                <IconButton size="small" aria-label="쪽지 접기" onClick={() => setOpen(false)} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <UnfoldLessIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Tooltip>
              {canEdit && !editing && (
                <Tooltip title="제목·내용 수정">
                  <IconButton size="small" aria-label="메모 수정" onClick={startEdit} sx={{ color: 'text.secondary', p: 0.5 }}>
                    <EditIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
              {canDraw && (
                <Tooltip title={item.drawing?.length ? '화면 그림 고치기' : '화면에 그리기'}>
                  <IconButton
                    size="small"
                    aria-label="화면에 그리기"
                    onClick={() => { setOpen(false); onDraw(item.num) }}
                    sx={{ color: item.drawing?.length ? 'primary.main' : 'text.secondary', p: 0.5 }}
                  >
                    <GestureIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip title="요청 삭제">
                  {/* 되돌릴 수 없는 동작이라 빨강 — 수정·접기(중립 회색)와 무게를 구분한다 */}
                  <IconButton size="small" aria-label="요청 삭제" onClick={() => setDelAsk(true)} disabled={busy} sx={(th) => ({ color: th.palette.accentText.red, p: 0.5 })}>
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
                {/* 제목 칸 없음 — 게시판 제목은 내용 첫 줄에서 만든다(사용자 지시 2026-08-05) */}
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
                  <Button size="small" variant="contained" onClick={saveEdit} disabled={busy || !eContent.trim()}>
                    {busy ? '저장 중…' : '저장'}
                  </Button>
                </Box>
              </Box>
            ) : (
              /* 제목 줄 없이 내용만 — 제목은 내용 첫 줄에서 파생되므로 같이 보이면 같은 문장이 두 번 나온다 */
              <RichBodyView
                html={item.content || item.title}
                sx={{ fontSize: typescale.body.size, lineHeight: 1.65, color: 'text.primary', maxHeight: 200, overflowY: 'auto' }}
              />
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

  // 메뉴·확인창은 MUI가 body로 포털하므로 쪽지의 끌기·토글 핸들러와 섞이지 않는다.
  // 쪽지 안이 아니라 여기(형제 자리)에 두는 것도 같은 이유 — 쪽지가 다시 그려져도 영향을 안 받는다.
  const dialogs = (
    <>
      {/* 기준점이 없으면 아예 열지 않는다 — MUI Popover 는 anchorEl 이 없으면 좌상단(0,0)에 뜬다 */}
      <Menu anchorEl={stBtnRef.current} open={stOpen && !!stBtnRef.current} onClose={() => setStOpen(false)}>
        {IMP_STATUSES.map((s) => (
          <MenuItem
            key={s}
            selected={s === st}
            onClick={() => { setStOpen(false); onStatusPick(s) }}
            sx={{ fontSize: typescale.body.size }}
          >
            {s}
          </MenuItem>
        ))}
      </Menu>
      <ConfirmDialog
        open={delAsk}
        destructive
        title={`요청 #${item.num}을 삭제할까요?`}
        description="쪽지뿐 아니라 개선요청 게시판에서도 사라집니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        busy={busy}
        onConfirm={removeRequest}
        onClose={() => setDelAsk(false)}
      />
      <ConfirmDialog
        open={!!statusAsk}
        title={`상태를 '${statusAsk?.status || ''}'로 바꿀까요?`}
        /* 보류·불가는 사유가 필수 — 게시판과 같은 규칙. ConfirmDialog 는 본문을 description 으로 받는다. */
        description={
          <>
            <Box component="span" sx={{ fontSize: typescale.body.size, color: 'text.primary' }}>
              이 화면의 쪽지는 내려가고 요청은 게시판에 그대로 남습니다.
            </Box>
            {statusAsk && needsReason(statusAsk.status) && (
              <TextField
                size="small"
                fullWidth
                autoFocus
                value={statusAsk.reason}
                onChange={(e) => setStatusAsk({ ...statusAsk, reason: e.target.value })}
                placeholder={`${statusAsk.status} 사유`}
                disabled={busy}
                slotProps={{ htmlInput: { 'aria-label': `${statusAsk.status} 사유` } }}
                sx={{ mt: 1.5 }}
              />
            )}
          </>
        }
        confirmLabel="변경"
        busy={busy}
        onConfirm={() => {
          if (!statusAsk) return
          if (needsReason(statusAsk.status) && !statusAsk.reason.trim()) return snack('사유를 입력해주세요.', 'error')
          void saveStatus(statusAsk.status, needsReason(statusAsk.status) ? statusAsk.reason.trim() : '')
        }}
        onClose={() => setStatusAsk(null)}
      />
    </>
  )

  // 접힘 상태는 핀만 보이므로 무슨 요청인지 알 수 없다 — 마우스를 올리면 제목이 뜬다
  return (
    <>
      {open ? note : <Tooltip title={`#${item.num} ${item.title}`} placement="left">{note}</Tooltip>}
      {dialogs}
    </>
  )
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
  const [drawFor, setDrawFor] = useState<string | null>(null) // 그리기 중인 쪽지 번호(관리자 전용)
  const snack = useSnack()
  const attachLayer = useCallback((el: HTMLDivElement | null) => {
    layerRef.current = el
    setLayerEl(el)
  }, [])

  const items = useAppSelector((s) => s.improve.items)
  const replyItems = useAppSelector((s) => s.reply.items)
  const saved = useAppSelector((s) => s.userSettings.settings[POS_KEY]) as PosMap | undefined
  // 개인 설정 로드 성공 여부 — 자리 배정·저장의 게이트(아래 effect 주석 참조)
  const usLoadedOk = useAppSelector((s) => s.userSettings.loadedOk)

  // 칩·패널·배지와 같은 기준 — 작성자 본인 + 포털 관리자만(2026-08-05).
  // 쪽지는 화면 위에 떠 있어서 남의 것이 보이면 그 사람 할 일이 내 화면을 덮는다.
  const memos = useMemo(() => memosForPath(visibleMemos(items, user, isAdmin), pathname), [items, pathname, user, isAdmin])
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
   *
   * ⚠ **개인 설정 로드가 성공하기 전에는 절대 배정하지 않는다**(usLoadedOk 게이트).
   * 로드 전에는 saved 가 비어 있어 모든 쪽지가 '자리 없음'으로 보이고, 그대로 기본 자리를
   * 배정·저장하면 **서버에 있던 내 좌표를 덮어쓴다** — 새로고침할 때마다 압정이 가끔
   * 처음 자리로 돌아가던 원인이다(2026-08-05 사용자 신고). 같은 이유로 useMarkSeen·
   * work.order 도 loadedOk 를 게이트로 쓴다.
   */
  useEffect(() => {
    if (!layerEl || memos.length === 0 || !usLoadedOk) return
    const need = memos.filter((t) => !saved?.[t.num])
    if (need.length === 0) return
    const taken = memos.filter((t) => saved?.[t.num]).map((t) => saved![t.num])
    const patch: PosMap = {}
    for (const t of need) {
      let n = 0
      while (n < MAX_SLOT && overlaps(slotPx(layerEl, n), taken)) n++
      const px = slotPx(layerEl, n)
      taken.push(px)
      patch[t.num] = px
    }
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), ...patch } }))
  }, [layerEl, memos, saved, usLoadedOk, dispatch])

  // 옮긴 위치는 개인 설정에 저장(디바운스 병합) — 다른 사람 화면은 움직이지 않는다
  const onMoveEnd = useCallback((num: string, pos: Pos) => {
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), [num]: pos } }))
  }, [dispatch, saved])

  /**
   * 화면 그림 — **포털 관리자 전용**(2026-08-05 사용자 지시).
   * 고칠 곳을 말로 설명하는 대신 화면에 직접 표시해 두는 편의 도구라, 구성원에게는
   * 도구도 그림도 노출하지 않는다. 저장은 쪽지(개선요청)에 딸린다 — 그림만 따로 떠다니지 않는다.
   */
  const drawTarget = memos.find((t) => t.num === drawFor) || null
  const saveDrawing = async (strokes: MemoStroke[]) => {
    if (!user || !authKey) return
    setDrawFor(null)
    if (strokes.length === 0 && !drawTarget) return // 새로 그리다 아무것도 안 남기면 쪽지도 만들지 않는다
    try {
      if (drawTarget) {
        await updateImprovement({ author: user, key: 'session', num: drawTarget.num, drawing: strokes.length ? strokes : null })
      } else {
        // 상단바에서 바로 그린 경우 — 그림을 담을 쪽지를 이 화면에 새로 만든다(내용은 나중에 쪽지에서)
        const loc = pathToLocation(pathname)
        const num = await createImprovement({ author: user, key: authKey, loc: loc || '기타', title: '', content: '', mgr: user })
        await updateImprovement({ author: user, key: 'session', num, memo: true, drawing: strokes })
      }
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '그림 저장에 실패했습니다', 'error')
    }
  }

  // 상단바 '그리기' 버튼 신호 — 쪽지가 없어도 바로 그릴 수 있게(관리자 전용)
  useEffect(() => {
    if (!isAdmin) return
    const start = () => setDrawFor('new')
    window.addEventListener(MEMO_DRAW_EVENT, start)
    return () => window.removeEventListener(MEMO_DRAW_EVENT, start)
  }, [isAdmin])

  // 쪽지가 없어도 관리자면 레이어를 띄운다 — 상단바 '그리기'가 언제나 열려야 하므로.
  // (레이어는 클릭을 통과시키므로 비어 있어도 화면을 가리지 않는다.)
  if (!isMember || !isDesktop || (memos.length === 0 && !isAdmin)) return null

  return (
    <Box
      aria-label="화면 메모"
      sx={{
        position: 'fixed',
        top: `${TOPBAR_H}px`,
        left: `${RAIL_W}px`,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',   // 레이어 자체는 클릭을 통과시키고, 쪽지만 받는다(pointer-events는 상속된다)
        zIndex: z.stickyMemo,
      }}
    >
      {/* 좌표 기준 = 본문 칸. PageContainer(최대 1400·가운데 정렬)와 같은 상자를 겹쳐 두고
          그 좌상단을 (0,0)으로 삼는다. 그래야 해상도가 달라져도 쪽지가 표의 같은 지점 옆에 남는다
          — 화면 전체를 기준으로 삼으면 본문은 안 넓어지는데 좌표만 벌어져 여백으로 밀려난다. */}
      <Box ref={attachLayer} sx={{ position: 'relative', height: '100%', width: '100%', maxWidth: `${layout.maxWidthWide}px`, mx: 'auto' }}>
        {/* 저장된 화면 그림 — 관리자에게만. 클릭은 통과시켜 아래 화면을 그대로 쓸 수 있게 한다.
            그리는 중에는 판(MemoDraw)이 같은 획을 그리므로 여기서는 숨긴다(이중 렌더 방지). */}
        {isAdmin && !drawFor && memos.map((t) => (
          t.drawing?.length ? (
            <Box
              key={`d-${t.num}`}
              component="svg"
              aria-hidden
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
            >
              {t.drawing.map((s, i) => (
                <Box
                  component="polyline"
                  key={i}
                  points={pointsOf(s.p)}
                  fill="none"
                  sx={{ stroke: s.c === INK ? 'text.primary' : s.c }}
                  strokeWidth={s.w}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Box>
          ) : null
        ))}

        {/* 그리기 판 — 진입하면 쪽지는 접히고 화면 전체가 그리기 대상이 된다 */}
        {isAdmin && drawFor && (
          <MemoDraw
            layerRef={layerRef}
            initial={drawTarget?.drawing}
            onDone={(strokes) => void saveDrawing(strokes)}
            onCancel={() => setDrawFor(null)}
          />
        )}

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
              // 구성원 쓰기 개방(2026-08-05)
              canEdit={isMember && !!user && !!authKey}
              // 삭제는 게시판과 같은 규칙 — DB improvements_delete 의 술어와 맞춘다
              canDelete={!!user && !!authKey && (isAdmin || (t.mgr || '').trim() === '' || t.mgr === user)}
              // 그리기는 포털 관리자 전용 — 구성원에게는 버튼 자체가 없다
              canDraw={isAdmin && !!user && !!authKey}
              user={user}
              onMoveEnd={onMoveEnd}
              onDraw={setDrawFor}
            />
          )
        })}
      </Box>
    </Box>
  )
}
