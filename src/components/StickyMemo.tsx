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
import StickyNote2Icon from '@mui/icons-material/StickyNote2'
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
import { fetchPageDrawings, createPageDrawing, updatePageDrawing, deletePageDrawing, linkDrawingToRequest } from '@/api/pageDrawings'
import type { PageDrawing } from '@/api/pageDrawings'
import { fetchPageNotes, createPageNote, updatePageNote, deletePageNote, fetchPageNoteReplies, createPageNoteReply, deletePageNoteReply } from '@/api/pageNotes'
import type { PageNote, PageNoteReply } from '@/api/pageNotes'
import { fetchAuthors } from '@/api/works'
import { MemoKindPicker, MemoKindHint, SharePicker, plainText, DEFAULT_MEMO_KIND, PAGE_NOTES_CHANGED, notifyPageNotesChanged } from '@/components/memoKind'
import type { MemoKind } from '@/components/memoKind'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import MemoDraw, { StrokeShape, MEMO_DRAW_EVENT } from '@/components/MemoDraw'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import { useRole } from '@/auth/role'
import { memosForPath, visibleMemos, pathToLocation, firstLine, matchesPath } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import { RichBodyView } from '@/utils/richBody'
import ButtonBase from '@mui/material/ButtonBase'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { StatusChip, useSnack, ConfirmDialog } from '@/components/ds'
import { IMP_STATUSES, impKind, isSettled, needsReason, normStatus } from '@/pages/Improve/improveMeta'
import { iconSize, layout, motion, radius, shadow, typescale, weight, z } from '@/theme/tokens'
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

/** 후광 번짐 반경(px) — 필터 영역을 이만큼 넉넉히 잡아야 가장자리가 잘리지 않는다 */
const GLOW_BLUR = 6
/**
 * 획 전체를 감싸는 사각형 — SVG 필터 영역 계산용.
 * 필터 영역을 bbox 비율(기본값)로 두면 **가로로 곧은 획은 높이가 0**이라 영역도 0이 되어
 * 후광이 아예 안 그려진다. 그래서 좌표에서 직접 구해 px(userSpaceOnUse)로 지정한다.
 */
function glowBox(strokes: MemoStroke[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, w = 0
  for (const s of strokes) {
    w = Math.max(w, s.w)
    for (let i = 0; i + 1 < s.p.length; i += 2) {
      x0 = Math.min(x0, s.p[i]); x1 = Math.max(x1, s.p[i])
      y0 = Math.min(y0, s.p[i + 1]); y1 = Math.max(y1, s.p[i + 1])
    }
  }
  if (!Number.isFinite(x0)) return null
  const pad = w / 2 + GLOW_BLUR * 4
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
}

/** 상단바 높이 — 레이어 상단 기준(구 index.css body padding-top 53과 같은 값) */
const TOPBAR_H = 53
/** PC 사이드바 레일 폭 — 레이어 좌측 기준(SideNav 64px 레일) */
const RAIL_W = 64
/** 펼친 쪽지 폭 */
const OPEN_W = 300
/** 그리기 직후 뜨는 입력창 폭 — 그림 옆에 붙으므로 쪽지보다 조금 좁게 */
const NOTE_W = 260
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

/**
 * 쪽지 끌기·되당김 공용 훅 — 요청메모(StickyNote)와 일반메모(PlainNote)가 같은 몸놀림을 갖도록.
 *
 * 두 쪽지는 겉모습만 다르고 "잡아 끌면 옮겨지고, 제자리 클릭이면 펼쳐지고, 커지면 화면 안으로
 * 되당겨진다"는 동작이 완전히 같다(사용자: "사용성은 다 똑같다"). 복사해 두면 한쪽만 고치는
 * 사고가 나므로 여기 한 곳에 둔다.
 *
 * @param key   저장 키 — 요청은 요청번호, 일반메모는 'n{id}'
 * @param deps  높이를 바꾸는 값들(펼침·답글 수 등) — 바뀌면 되당김을 다시 계산한다
 */
function useNoteDrag(opts: {
  key: string
  pos: Pos
  layerRef: React.RefObject<HTMLDivElement | null>
  onMoveEnd: (key: string, pos: Pos) => void
  onTapToggle: () => void
  deps: unknown[]
}) {
  const { key, pos, layerRef, onMoveEnd, onTapToggle, deps } = opts
  const elRef = useRef<HTMLDivElement>(null)
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
  }, [clamp, pos, ...deps])

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
    if (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP) { d.moved = true }
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
    if (d.moved) { onMoveEnd(key, latest.current); return }   // 끌었으면 위치만 저장하고 토글하지 않는다
    if (isInteractive(e.target as HTMLElement)) return
    onTapToggle()                                            // 제자리 클릭 = 펼침/접힘 토글
  }

  return {
    elRef,
    live,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => { drag.current.on = false },
    },
  }
}

interface NoteProps {
  item: ImprovementItem
  replies: ReplyRow[]
  pos: Pos
  layerRef: React.RefObject<HTMLDivElement | null>
  canEdit: boolean
  /** 요청 자체를 지울 수 있는가 — 게시판과 같은 규칙(담당자 본인 또는 포털 관리자) */
  canDelete: boolean
  user: string | null
  onMoveEnd: (num: string, pos: Pos) => void
  /** 처음부터 펼친 채로 — 그리기 직후 방금 만든 쪽지에만 쓴다 */
  defaultOpen?: boolean
}

function StickyNote({ item, replies, pos, layerRef, canEdit, canDelete, user, onMoveEnd, defaultOpen }: NoteProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  // 상태 메뉴 기준점은 ref 로 잡는다 — 클릭 시점의 currentTarget 을 state 에 담아 두면
  // 쪽지가 다시 그려질 때 그 노드가 떨어져 나가 메뉴가 화면 좌상단(0,0)에 뜬다(2026-08-05 사용자 신고).
  // 상단바 메모 버튼(MemoComposeButton)도 같은 이유로 ref 방식을 쓴다.
  const stBtnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(!!defaultOpen)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  // 쪽지에서 바로 제목·내용 수정 — 게시판까지 가지 않아도 고칠 수 있게(수정 권한은 게시판과 동일)
  const [editing, setEditing] = useState(false)
  const [eContent, setEContent] = useState('')
  const [stOpen, setStOpen] = useState(false)                                        // 상태 메뉴 열림
  const [delAsk, setDelAsk] = useState(false)                                        // 요청 삭제 확인
  const [statusAsk, setStatusAsk] = useState<{ status: string; reason: string } | null>(null) // 종결 확인(+사유)

  // 쪽지↔그림 짝짓기(hover/onActive)는 2026-08-06 그림 분리로 사라졌다 —
  // 이제 그림이 자기 위에서 직접 빛나므로 압정이 신호를 보낼 이유가 없다.
  const { elRef, live, handlers } = useNoteDrag({
    key: item.num, pos, layerRef, onMoveEnd,
    onTapToggle: () => setOpen((o) => !o),
    deps: [open, replies.length],
  })

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
      {...handlers}
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
        // 호버 z 는 펼침 값(3)보다 낮으면 안 된다 — 종전의 고정 2 는 겹친 쪽지 둘 중
        // 마우스를 올린 쪽을 오히려 뒤로 밀어 위아래로 깜빡였다
        '&:hover': { borderColor: th.palette.accent.amber, zIndex: open ? 3 : 2 },
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
              {/* 그리기 버튼은 여기 없다 — 그림은 쪽지 소유물이 아니라 따로 사는 물건이 됐다(2026-08-06).
                  그리기는 상단바 버튼으로 시작하고, 있는 그림은 그림을 눌러 고친다. */}
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
                  // isComposing 검사가 없으면 한글 조합을 Enter 로 확정하는 순간 답글이 전송된다
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void sendReply() } }}
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
 * 일반메모 쪽지 — 개선요청이 아닌 개인 메모(2026-08-06 신설).
 *
 * 요청메모(StickyNote)와 **몸놀림은 같고**(useNoteDrag 공용) 다른 것만 다르다:
 *  · 상태(접수·완료…) 없음 · 요청번호 없음 · 연동 게시판 없음 → 그 자리가 통째로 비었다
 *  · 접힌 모양이 압정이 아니라 메모지(StickyNote2 채움)
 *  · 열람은 작성자 + 공유받은 사람. 고치기·지우기·공유 변경은 **작성자만**
 *
 * 답글은 없다 — 요청메모의 답글은 improvement_replies(요청번호 기준)라 그대로 쓸 수 없고,
 * 개인 메모에 스레드가 필요한지가 아직 정해지지 않았다.
 */
function PlainNote({ note, replies, pos, layerRef, mine, user, people, onMoveEnd, onChanged, onReplied, defaultOpen }: {
  note: PageNote
  /** 이 메모의 답글 — 작성자와 공유받은 사람이 주고받는다 */
  replies: PageNoteReply[]
  pos: Pos
  layerRef: React.RefObject<HTMLDivElement | null>
  /** 내가 쓴 메모인가 — 아니면(공유받은 것) 내용·공유 수정은 못 한다. 답글은 쓸 수 있다 */
  mine: boolean
  user: string | null
  /** 공유 대상 후보(profiles 이름) */
  people: string[]
  onMoveEnd: (key: string, pos: Pos) => void
  onChanged: () => void
  onReplied: () => void
  defaultOpen?: boolean
}) {
  const snack = useSnack()
  const [open, setOpen] = useState(!!defaultOpen)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [eContent, setEContent] = useState('')
  const [eShared, setEShared] = useState<string[]>([])
  const [delAsk, setDelAsk] = useState(false)
  const [reply, setReply] = useState('')

  const { elRef, live, handlers } = useNoteDrag({
    key: `n${note.id}`, pos, layerRef, onMoveEnd,
    onTapToggle: () => setOpen((o) => !o),
    deps: [open, editing, note.shared.length, replies.length],
  })

  const sendReply = async () => {
    const v = reply.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      await createPageNoteReply({ noteId: note.id, content: v })
      setReply('')
      onReplied()
    } catch (err) {
      snack(err instanceof Error ? err.message : '답글 등록에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeReply = async (id: number) => {
    try {
      await deletePageNoteReply(id)
      onReplied()
    } catch (err) {
      snack(err instanceof Error ? err.message : '답글 삭제에 실패했습니다', 'error')
    }
  }

  const startEdit = () => {
    setEContent(note.content || '')
    setEShared(note.shared)
    setEditing(true)
  }

  const save = async () => {
    const body = eContent.trim()
    if (!body) return snack('내용을 입력해주세요.', 'error')
    setBusy(true)
    try {
      await updatePageNote({ id: note.id, content: body, shared: eShared })
      setEditing(false)
      snack('수정했습니다.', 'success')
      onChanged()
      notifyPageNotesChanged()
    } catch (err) {
      snack(err instanceof Error ? err.message : '수정에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deletePageNote(note.id)
      setDelAsk(false)
      snack('메모를 지웠습니다.', 'success')
      onChanged()
      notifyPageNotesChanged()
    } catch (err) {
      snack(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const folded = (
    // 접힌 모양이 요청메모(압정)와 달라야 한 눈에 갈래가 구분된다(사용자 지시 2026-08-06)
    <Box sx={(th) => ({ display: 'grid', placeItems: 'center', width: 34, height: 34, color: th.palette.accent.amber })}>
      <StickyNote2Icon sx={{ fontSize: iconSize.header }} />
    </Box>
  )

  const body = (
    <Box
      ref={elRef}
      {...handlers}
      sx={(th) => ({
        position: 'absolute',
        left: `${live.x}px`,
        top: `${live.y}px`,
        width: open ? OPEN_W : 'auto',
        zIndex: open ? 3 : 1,
        pointerEvents: 'auto',
        cursor: 'grab',
        touchAction: 'none',
        userSelect: 'none',
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(th.palette.accent.amber, 0.5)}`,
        borderRadius: `${radius.card}px`,
        boxShadow: shadow.lg,
        transition: 'border-color .15s, box-shadow .15s',
        '&:hover': { borderColor: th.palette.accent.amber, zIndex: open ? 3 : 2 },
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
            <StickyNote2Icon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
            {/* 상태 칩도 요청번호도 없다 — 일반메모에는 그런 게 없다(사용자 지시) */}
            <Box component="span" sx={(th) => ({ fontSize: typescale.caption.size, fontWeight: weight.heavy, color: th.palette.accentText.amber })}>
              메모
            </Box>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
              <Tooltip title="접기">
                <IconButton size="small" aria-label="메모 접기" onClick={() => setOpen(false)} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <UnfoldLessIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Tooltip>
              {mine && !editing && (
                <Tooltip title="내용·공유 수정">
                  <IconButton size="small" aria-label="메모 수정" onClick={startEdit} sx={{ color: 'text.secondary', p: 0.5 }}>
                    <EditIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
              {mine && (
                <Tooltip title="메모 삭제">
                  <IconButton size="small" aria-label="메모 삭제" onClick={() => setDelAsk(true)} disabled={busy} sx={(th) => ({ color: th.palette.accentText.red, p: 0.5 })}>
                    <DeleteOutlineIcon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>
            {editing ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <RichBodyEditor
                  value={eContent}
                  onChange={setEContent}
                  placeholder="내용"
                  ariaLabel="메모 내용"
                  fontSize={typescale.small.size}
                  minHeight={64}
                  framed
                  onCtrlEnter={() => void save()}
                />
                <SharePicker people={people} value={eShared} onChange={setEShared} disabled={busy} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <Button size="small" onClick={() => setEditing(false)} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
                  <Button size="small" variant="contained" onClick={save} disabled={busy || !eContent.trim()}>
                    {busy ? '저장 중…' : '저장'}
                  </Button>
                </Box>
              </Box>
            ) : (
              <RichBodyView
                html={note.content}
                sx={{ fontSize: typescale.body.size, lineHeight: 1.65, color: 'text.primary', maxHeight: 200, overflowY: 'auto' }}
              />
            )}
            {/* 게시판 버튼 없음 — 일반메모는 연동되는 게시판이 없다(사용자 지시 2026-08-06) */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: 'text.secondary' }}>
                <PersonOutlineIcon sx={{ fontSize: iconSize.caption }} />{note.author || '-'}
              </Box>
              {!editing && note.shared.length > 0 && (
                <Tooltip title={`공유 중: ${note.shared.join(', ')}`}>
                  <Box
                    component="span"
                    sx={(th) => ({
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      fontSize: typescale.caption.size, color: 'accentText.blue',
                      bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: `${radius.pill}px`,
                    })}
                  >
                    <GroupOutlinedIcon sx={{ fontSize: iconSize.caption }} />
                    {note.shared.length}명 공유
                  </Box>
                </Tooltip>
              )}
              {!mine && (
                <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>공유받음</Box>
              )}
            </Box>

            {/* 답글 — 작성자와 공유받은 사람이 주고받는다(사용자 지시 2026-08-06).
                요청메모의 답글과 저장소가 다르다(page_note_replies) — 요청번호가 없기 때문 */}
            {replies.length > 0 && (
              <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 132, overflowY: 'auto' }}>
                {replies.map((r) => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, bgcolor: 'background.elevated', borderRadius: `${radius.chip}px`, px: 1, py: 0.75 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: 'text.primary', mr: 0.75 }}>
                        {r.author || '-'}
                      </Box>
                      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.secondary', overflowWrap: 'anywhere' }}>{r.content}</Box>
                    </Box>
                    {!!user && r.author === user && (
                      <Tooltip title="답글 삭제">
                        <IconButton size="small" aria-label="답글 삭제" onClick={() => void removeReply(r.id)} sx={{ p: 0.25, color: 'text.disabled', flexShrink: 0 }}>
                          <DeleteOutlineIcon sx={{ fontSize: iconSize.caption }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* 공유받은 사람도 답글은 쓸 수 있어야 '주고받는다'가 성립한다 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
              <TextField
                size="small"
                fullWidth
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                // isComposing 검사가 없으면 한글 조합을 Enter 로 확정하는 순간 답글이 전송된다
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void sendReply() } }}
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
          </Box>
        </>
      )}
    </Box>
  )

  return (
    <>
      {open ? body : <Tooltip title={plainText(note.content) || '메모'} placement="left">{body}</Tooltip>}
      <ConfirmDialog
        open={delAsk}
        destructive
        title="이 메모를 지울까요?"
        description="되돌릴 수 없습니다. 딸린 그림은 그대로 남습니다."
        confirmLabel="삭제"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDelAsk(false)}
      />
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
  // 'new' = 새로 그리는 중, 숫자 = 그 그림(page_drawings.id)을 고치는 중
  const [drawFor, setDrawFor] = useState<'new' | number | null>(null)
  // 그리기 완료 직후 — 그림 옆에서 선택/내용을 받는 중.
  // ask=true 면 '메모를 붙일지' 묻는 단계, false 면 메모 입력 단계(2026-08-06 사용자 지시 — 그림만 남기고
  // 싶을 때도 있으니 입력창을 바로 띄우지 말고 먼저 물을 것).
  /**
   * 그리기 직후(또는 '메모 붙이기') 뜨는 입력창.
   *  · drawId   … 이 메모가 딸릴 그림 행 번호. 아직 그림을 안 만들었으면 없다.
   *  · existing … 그 그림이 **입력창을 열기 전부터 있던 것**인가. 참이면 '취소'해도 그림은 그대로 둔다
   *               (거짓이면 이 입력창이 만든 것이라 취소 시 함께 지운다).
   */
  const [pending, setPending] = useState<
    { strokes: MemoStroke[]; x: number; y: number; ask?: boolean; drawId?: number; existing?: boolean } | null
  >(null)
  const [pendingText, setPendingText] = useState('')
  // 그림 옆 입력창에서 고른 갈래·공유 대상(상단바 메모 버튼과 같은 규칙 — 기본은 일반메모)
  const [pendingKind, setPendingKind] = useState<MemoKind>(DEFAULT_MEMO_KIND)
  const [pendingShared, setPendingShared] = useState<string[]>([])
  const [busyPending, setBusyPending] = useState(false)
  const [openNum, setOpenNum] = useState<string | null>(null) // 방금 만든 쪽지 — 처음부터 펼쳐 보인다
  /**
   * 저장된 화면 그림 — **개선요청과 별개 데이터**(page_drawings, 2026-08-06 분리).
   *
   * 소비자가 이 레이어 하나뿐이라 Redux 슬라이스를 따로 만들지 않았다.
   * 압정이 사라진 자리를 그림 자신이 대신한다 — hoverId 는 후광, selectedId 는 고치기·지우기 막대.
   */
  const [drawings, setDrawings] = useState<PageDrawing[]>([])
  /** 일반메모(page_notes) — RLS 가 '내 것 + 공유받은 것'만 준다 */
  const [notes, setNotes] = useState<PageNote[]>([])
  /** 일반메모 답글 — 볼 수 있는 메모의 것만 온다(RLS) */
  const [noteReplies, setNoteReplies] = useState<PageNoteReply[]>([])
  /** 방금 만든 일반메모 — 처음부터 펼쳐 보인다(요청메모의 openNum 과 같은 역할) */
  const [openNoteId, setOpenNoteId] = useState<number | null>(null)
  /** 공유 대상 후보 이름 — 작성 폼 오토컴플리트와 같은 출처(profiles) */
  const [people, setPeople] = useState<string[]>([])
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [delDraw, setDelDraw] = useState<number | null>(null)
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

  /** 입력창을 닫을 때 폼을 비운다 — 갈래·공유 대상이 남으면 다음 메모가 남의 설정을 물려받는다 */
  const resetPendingForm = () => {
    setPendingText('')
    setPendingKind(DEFAULT_MEMO_KIND)
    setPendingShared([])
  }

  /** 입력창 자리 = 그림 오른쪽 위(획들의 경계상자 기준). 레이어 밖으로 나가지 않게 당긴다 */
  const panelPos = (strokes: MemoStroke[]) => {
    const xs = strokes.flatMap((s) => s.p.filter((_, i) => i % 2 === 0))
    const ys = strokes.flatMap((s) => s.p.filter((_, i) => i % 2 === 1))
    const W = layerRef.current?.clientWidth ?? 0
    const H = layerRef.current?.clientHeight ?? 0
    return {
      x: Math.min(Math.max(Math.max(...xs) + 12, 0), Math.max(W - NOTE_W, 0)),
      y: Math.min(Math.max(Math.min(...ys), 0), Math.max(H - 150, 0)),
    }
  }

  /** 그림 목록 다시 읽기 — 저장·수정·삭제 뒤에 한 번씩. 소비자가 여기뿐이라 전역 상태로 올리지 않았다 */
  const reloadDrawings = useCallback(async () => {
    try {
      setDrawings(await fetchPageDrawings())
    } catch {
      snack('화면 그림을 불러오지 못했습니다.', 'error')
    }
  }, [snack])
  useEffect(() => { if (isMember) void reloadDrawings() }, [isMember, reloadDrawings])

  /** 일반메모 목록 다시 읽기 */
  const reloadNotes = useCallback(async () => {
    try {
      const [ns, rs] = await Promise.all([fetchPageNotes(), fetchPageNoteReplies()])
      setNotes(ns)
      setNoteReplies(rs)
    } catch {
      snack('메모를 불러오지 못했습니다.', 'error')
    }
  }, [snack])
  // 상단바 메모 버튼에서 만든 것도 바로 뜨게 — 두 곳이 부모 상태를 공유하지 않아 이벤트로 잇는다
  useEffect(() => {
    if (!isMember) return
    void reloadNotes()
    const onChanged = () => void reloadNotes()
    window.addEventListener(PAGE_NOTES_CHANGED, onChanged)
    return () => window.removeEventListener(PAGE_NOTES_CHANGED, onChanged)
  }, [isMember, reloadNotes])

  // 공유 대상 후보는 한 번만 — 사람 목록은 자주 바뀌지 않는다
  useEffect(() => {
    if (!isMember) return
    let alive = true
    void fetchAuthors().then((n) => { if (alive) setPeople(n) }).catch(() => {})
    return () => { alive = false }
  }, [isMember])

  /**
   * 이 화면의 그림.
   *
   * 가시성은 **서버(RLS)가 정한다** — 내 것 + 포털 관리자 + 딸린 일반메모를 공유받은 사람.
   * 종전에는 읽기 정책이 using(true) 라 화면에서 걸렀는데, 일반메모에 '작성자만'이라는
   * 약속이 생긴 이상 화면 필터로는 부족하다(docs/db/page-notes.sql).
   *
   * 경로 매칭은 **쪽지와 같은 규칙**(matchesPath — 하위 경로 포함)을 쓴다.
   * 완전 일치로 좁혔더니 `/notice` 에서 그린 그림이 `/notice/12` 로 딥링크할 때 사라졌다.
   * 두 경로는 같은 목록 화면이고 레이어는 스크롤도 안 따라가므로 픽셀 단위로 같은 자리다 —
   * 한 번의 조작으로 만든 그림과 쪽지가 서로 다른 규칙으로 나타나면 그게 더 이상하다.
   */
  const hereDraw = useMemo(
    () => drawings.filter((d) => matchesPath(pathname, d.path)),
    [drawings, pathname],
  )

  /**
   * 이 화면의 일반메모 — 서버가 이미 '내 것 + 공유받은 것'만 준다(RLS).
   * 그림과 달리 포털 관리자도 예외가 아니다 — 그게 요청메모와 갈리는 지점이다.
   */
  const hereNotes = useMemo(() => notes.filter((n) => matchesPath(pathname, n.path)), [notes, pathname])
  const editingDraw = typeof drawFor === 'number' ? drawings.find((d) => d.id === drawFor) || null : null
  // 고치는 중에는 도구막대를 내린다 — 판이 그 위를 덮어 눌리지도 않는 유령 버튼이 되고,
  // 판 밖(위쪽)으로 삐져나온 조각은 눌려서 편집 중인 그림을 지워 버린다(적대적 리뷰 확인).
  // 입력창이 떠 있을 때도 내린다 — 같은 자리에 겹쳐 뜬다(후광은 남아 대상이 어느 그림인지 보인다).
  const selectedDraw = drawFor === null && !pending ? hereDraw.find((d) => d.id === selectedId) || null : null
  /**
   * 고르긴 했는데 **손댈 수 있는 그림인가** — 쓰기 정책(is_admin() or 본인)과 같은 기준.
   *
   * 공유받은 남의 그림도 화면에는 뜬다. 거기에 고치기·지우기 막대를 그대로 띄우면
   * 눌러도 RLS 가 행을 걸러 아무 일이 안 일어나는데 '지웠습니다'만 뜬다(적대적 리뷰 확인).
   * 아예 안 띄우는 것이 맞다 — 못 하는 일은 보이지 않아야 한다.
   */
  const canEditDraw = !!selectedDraw && (isAdmin || selectedDraw.author === user)
  /**
   * 메모 붙이기는 **내 그림에만**. 관리자는 남의 그림을 고칠 수는 있어도 거기에 자기 메모를 달아
   * 제3자에게 공유할 수는 없다 — 그림 주인 모르게 그림이 퍼진다. DB도 같은 기준으로 막는다
   * (page_notes_insert 의 drawing_id 소유권 검사).
   */
  const canAttachMemo = !!selectedDraw && selectedDraw.author === user

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
    // 요청메모(번호)와 일반메모('n{id}')가 같은 좌표 맵을 나눠 쓴다 — 접두사로 갈라 키가 안 겹친다
    const keys = [...memos.map((t) => t.num), ...hereNotes.map((n) => `n${n.id}`)]
    if (!layerEl || keys.length === 0 || !usLoadedOk) return
    const need = keys.filter((k) => !saved?.[k])
    if (need.length === 0) return
    const taken = keys.filter((k) => saved?.[k]).map((k) => saved![k])
    const patch: PosMap = {}
    for (const t of need) {
      let n = 0
      while (n < MAX_SLOT && overlaps(slotPx(layerEl, n), taken)) n++
      const px = slotPx(layerEl, n)
      taken.push(px)
      patch[t] = px
    }
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), ...patch } }))
  }, [layerEl, memos, hereNotes, saved, usLoadedOk, dispatch])

  /**
   * 좌표 한 건 저장 — 요청메모는 요청번호, 일반메모는 'n{id}' 를 키로 쓴다.
   *
   * ⚠ 자리 배정 effect 와 같은 게이트(usLoadedOk). 개인 설정 로드가 실패한 상태에서 저장하면
   * saved 가 비어 있어 **서버에 있던 다른 쪽지 좌표를 통째로 날린다**(이 키는 맵 통째로 치환).
   */
  const savePos = useCallback((key: string, pos: Pos) => {
    if (!usLoadedOk) return
    dispatch(putSetting({ key: POS_KEY, value: { ...(saved || {}), [key]: pos } }))
  }, [dispatch, saved, usLoadedOk])

  // 옮긴 위치는 개인 설정에 저장(디바운스 병합) — 다른 사람 화면은 움직이지 않는다
  const onMoveEnd = useCallback((key: string, pos: Pos) => savePos(key, pos), [savePos])

  /**
   * 화면 그림 — 구성원 이상(2026-08-06 개방).
   * 고칠 곳을 말로 설명하는 대신 화면에 직접 표시해 두는 도구.
   * **저장은 쪽지와 무관한 자기 테이블(page_drawings)** 이다 — 그림만 남길 수도, 메모를 함께 붙일 수도 있다.
   */

  /**
   * 그리기 완료 —
   *  · 있던 그림을 고친 것이면 바로 저장한다(전부 지우고 완료하면 그 그림을 삭제).
   *  · 새로 그린 것이면 **메모를 붙일지 먼저 묻는다**(2026-08-06 사용자 지시).
   */
  const finishDrawing = async (strokes: MemoStroke[]) => {
    if (!user || !authKey) { setDrawFor(null); return }
    if (editingDraw) {
      // ⚠ 판은 **저장에 성공한 뒤에** 닫는다. 먼저 닫으면 판이 사라지면서 고친 획이 로컬 state 와
      // 함께 증발해, 실패했을 때 되돌아갈 곳이 없다(사무실망 write 스톨 — 메모리 참고).
      // 판이 그대로 있으면 '완료'를 다시 누르는 것으로 재시도된다.
      try {
        if (strokes.length) {
          await updatePageDrawing({ id: editingDraw.id, strokes })
        } else {
          // 판에서 획을 전부 지우고 완료 = 그림을 없애겠다는 뜻
          await deletePageDrawing(editingDraw.id)
          setSelectedId(null)
          snack('그림을 지웠습니다.', 'success')
        }
        setDrawFor(null)
        await reloadDrawings()
      } catch (err) {
        snack(err instanceof Error ? err.message : '그림 저장에 실패했습니다. 완료를 다시 눌러 주세요.', 'error')
      }
      return
    }
    setDrawFor(null)
    if (strokes.length === 0) return // 아무것도 안 그렸으면 아무것도 만들지 않는다
    setPending({ strokes, ...panelPos(strokes), ask: true })
  }

  /**
   * 이미 저장된 그림에 **나중에** 메모를 붙인다(사용자 지시 2026-08-06).
   *
   * '그림만'으로 남겨 뒀다가 뒤늦게 설명을 달고 싶을 때 쓴다. 그림은 이미 있으므로
   * 만들지 않고(existing) 쪽지만 새로 만든다 — 둘은 여전히 서로 독립이다.
   */
  const attachMemo = (d: PageDrawing) => {
    setPending({ strokes: d.strokes, ...panelPos(d.strokes), ask: false, drawId: d.id, existing: true })
    setPendingText('')
  }

  /**
   * 그림 저장 — **그림과 메모는 서로 다른 물건**(2026-08-06 분리).
   *
   *  · withMemo=false … page_drawings 에 그림만 남긴다. 압정도 게시판 행도 생기지 않는다.
   *  · withMemo=true  … 위에 더해 개선요청(쪽지)을 하나 만든다. 둘은 각자 독립이라
   *    쪽지를 지워도 그림은 남고, 그림을 지워도 쪽지는 남는다.
   *
   * 그림의 손잡이는 압정이 아니라 **그림 자신**이다 — 획 위에 마우스를 올리면 빛나고,
   * 누르면 고치기·지우기 막대가 뜬다.
   */
  const savePending = async (withMemo: boolean) => {
    if (!pending || !user || !authKey) return
    const body = withMemo ? pendingText.trim() : ''
    setBusyPending(true)
    try {
      // 그림이 먼저 — 이게 이 화면에 남는 본체다.
      // ⚠ 만들어진 id 를 pending 에 적어 둔다. 뒤의 쪽지 저장이 실패하면 입력창이 그대로 남아
      // 사용자가 다시 '붙이기'를 누르는데, id 를 안 들고 있으면 누를 때마다 **같은 그림이 한 장씩
      // 더 쌓인다**(적대적 리뷰 확인). 두 번째부터는 새로 만들지 않고 그 행을 고친다.
      let drawId = pending.drawId
      if (drawId === undefined) {
        drawId = await createPageDrawing({ path: pathname, strokes: pending.strokes })
        const madeId = drawId
        setPending((p) => (p ? { ...p, drawId: madeId } : p))
      }
      if (withMemo && pendingKind === 'plain') {
        // 일반메모 — 게시판도 상태도 요청번호도 없다. 그림에 이어 두면 공유가 그림까지 따라간다
        const id = await createPageNote({ path: pathname, content: body, shared: pendingShared, drawingId: drawId })
        savePos(`n${id}`, { x: pending.x, y: pending.y })
        setOpenNoteId(id)
        notifyPageNotesChanged()
        await reloadNotes()
      } else if (withMemo) {
        const loc = pathToLocation(pathname)
        // 게시판 목록이 읽히려면 제목이 있어야 한다 — 내용이 있으면 첫 줄, 없으면 기본 제목
        const title = body ? firstLine(body) : `화면 메모 — ${loc || '기타'}`
        const num = await createImprovement({ author: user, key: authKey, loc: loc || '기타', title, content: body, mgr: user })
        // 연결되는 화면이 있을 때만 쪽지로 띄운다(MemoComposeButton 과 같은 규칙).
        // '기타'로 올린 것은 어느 화면에도 안 뜨므로 그리 되면 분명히 알린다.
        if (loc) await updateImprovement({ author: user, key: 'session', num, memo: true })
        else snack(`이 화면은 연결된 개선위치가 없어 게시판 접수만 됩니다. (요청 #${num})`, 'warning')
        // 쪽지를 **입력창이 있던 그 자리에 펼친 채로** 남긴다(2026-08-05 사용자 지시).
        savePos(String(num), { x: pending.x, y: pending.y })
        setOpenNum(String(num))
        // 그림을 요청에 이어 둔다 — 그러면 그림도 개선요청의 일부라 포털 관리자에게 보인다
        // (일반메모만 붙은 그림은 작성자와 공유받은 사람만 본다. 사용자 지시 2026-08-06)
        if (drawId !== undefined) await linkDrawingToRequest({ id: drawId, reqNum: num })
        dispatch(loadImproveData())
      } else {
        // 압정이 안 생기므로 "저장됐다"는 신호가 그림뿐이다 — 다루는 법을 한 번 알려 준다
        snack('그림을 남겼습니다. 그림 위에 마우스를 올리면 고치거나 지울 수 있습니다.', 'success')
      }
      setPending(null)
      resetPendingForm()
      // 선택도 푼다 — 안 그러면 방금 펼친 쪽지 위로 그림 도구막대가 다시 올라와 겹친다
      setSelectedId(null)
      await reloadDrawings()
    } catch (err) {
      snack(err instanceof Error ? err.message : '저장에 실패했습니다', 'error')
    } finally {
      setBusyPending(false)
    }
  }

  /**
   * 입력창 '버리기' — 아직 아무것도 저장 안 됐으면 그냥 닫는다.
   * 앞선 시도에서 그림만 저장된 상태라면 **그 행도 지운다** — 안 그러면 버린 줄 알았던 그림이
   * 새로고침 뒤에 나타난다(적대적 리뷰 확인).
   */
  const discardPending = async () => {
    // 원래 있던 그림에 메모만 달려던 것이면 그림은 건드리지 않는다
    const id = pending?.existing ? undefined : pending?.drawId
    setPending(null)
    resetPendingForm()
    setSelectedId(null)
    if (id === undefined) return
    try {
      await deletePageDrawing(id)
      await reloadDrawings()
    } catch {
      snack('그림을 되돌리지 못했습니다. 화면을 새로고침한 뒤 그림을 눌러 지워 주세요.', 'warning')
    }
  }

  /** 선택한 그림 지우기 — 확인 뒤 실행. 되돌릴 수 없다 */
  const removeDrawing = async (id: number) => {
    try {
      await deletePageDrawing(id)
      setSelectedId(null)
      setHoverId(null)
      await reloadDrawings()
      snack('그림을 지웠습니다.', 'success')
    } catch (err) {
      snack(err instanceof Error ? err.message : '그림 삭제에 실패했습니다', 'error')
    }
  }

  // 상단바 '그리기' 버튼 신호 — 쪽지가 없어도 바로 그릴 수 있게(관리자 전용).
  // 이미 그리는 중이면 무시한다 — 종전에는 다시 누르면 대상이 'new' 로 덮이면서 key 가 바뀌어
  // MemoDraw 가 통째로 새로 마운트됐고, 그리던 획이 아무 말 없이 전부 사라졌다.
  useEffect(() => {
    if (!isMember) return
    const start = () => setDrawFor((cur) => cur ?? 'new')
    window.addEventListener(MEMO_DRAW_EVENT, start)
    return () => window.removeEventListener(MEMO_DRAW_EVENT, start)
  }, [isMember])

  /**
   * 그림 선택 해제 — 아무 데나 누르거나 Esc.
   *
   * capture 로 받는다 — 아래 화면의 버튼이 이벤트를 삼켜도 선택은 풀려야 하기 때문이다.
   * ⚠ 그래서 **stopPropagation 으로는 막을 수 없다**(capture 는 window 가 제일 먼저 받는다).
   * 그림 자신과 도구막대를 그대로 두려면 출처를 봐야 한다 — 안 그러면 '고치기'를 누르는 순간
   * 선택이 풀려 막대가 사라지고, 버튼이 떨어져 나가 click 이 끝내 발생하지 않는다.
   */
  useEffect(() => {
    if (selectedId === null) return
    const off = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (t && typeof t.closest === 'function' && t.closest('[data-drawing-ui]')) return
      setSelectedId(null)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
    window.addEventListener('pointerdown', off, true)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('pointerdown', off, true)
      window.removeEventListener('keydown', esc)
    }
  }, [selectedId])

  /**
   * 화면을 옮기면 그리던 것을 정리한다.
   *
   * 레이어는 MainLayout 에 있어 경로가 바뀌어도 살아남는다. 그래서 그리기 판이나 입력창을
   * 열어 둔 채 다른 메뉴로 넘어간 뒤 '붙이기'를 누르면, 그림은 아까 화면의 것인데
   * 개선위치는 **지금 보고 있는 화면**으로 저장됐다(2026-08-05 전수검사에서 확인).
   * 그림은 그 화면을 가리키는 것이라 화면을 떠나면 의미가 없다 — 정리하고 알린다.
   * openNum(방금 만든 쪽지 자동 펼침)도 여기서 비운다. 안 그러면 그 화면에 들어올 때마다 계속 펼쳐진다.
   */
  const busyDrawRef = useRef(false)
  busyDrawRef.current = !!drawFor || !!pending
  useEffect(() => {
    setOpenNum(null)
    setOpenNoteId(null)
    setSelectedId(null)
    setHoverId(null)
    if (!busyDrawRef.current) return
    setDrawFor(null)
    setPending(null)
    setPendingText('')
    setPendingKind(DEFAULT_MEMO_KIND)
    setPendingShared([])
    snack('화면을 옮겨 그리던 그림을 닫았습니다.', 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // 쪽지가 없어도 관리자면 레이어를 띄운다 — 상단바 '그리기'가 언제나 열려야 하므로.
  // (레이어는 클릭을 통과시키므로 비어 있어도 화면을 가리지 않는다.)
  // 쪽지가 없어도 구성원이면 레이어를 띄운다 — 상단바 '그리기'가 언제나 열려야 하므로
  if (!isMember || !isDesktop) return null

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
        {/* 저장된 화면 그림. 획이 없는 자리는 클릭을 통과시켜 아래 화면을 그대로 쓸 수 있게 한다.
            **지금 고치는 중인 그림만** 숨긴다(그 획은 판이 그린다). */}
        {isMember && hereDraw.filter((d) => d.id !== drawFor).map((d) => {
          // 그림이 자기 손잡이다(2026-08-06) — 압정이 없어졌으므로 획 위 호버·클릭이 유일한 진입점이다.
          //  · 호버·선택 = 획 둘레가 앰버로 은은하게 빛난다(숨쉬듯). 원본 획은 그대로 둔다.
          // 후광이 필요한 이유: '나머지를 흐리게'만 하면 화면에 그림이 **한 장뿐일 때 아무 변화가 없다**.
          const active = hoverId === d.id || selectedId === d.id
          const box = active ? glowBox(d.strokes) : null
          const glowId = `pd-glow-${d.id}`
          return (
            <Box
              key={`d-${d.id}`}
              component="svg"
              sx={{
                // svg 자체는 클릭을 통과시킨다 — 켜면 본문 칸 1400px 전체가 아래 화면의 클릭을 삼킨다.
                // 실제로 마우스를 받는 건 아래 '히트 전용' 그룹뿐이다.
                position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
                // svg 는 기본이 overflow:hidden — 본문 칸(최대 1400) 밖 여백이나 상단바 위로 그은 획이
                // 저장은 되는데 화면에서는 잘려 사라졌다. 그리기 판은 그 밖에서도 좌표를 받는다.
                overflow: 'visible',
                zIndex: active ? 1 : 0,
                transition: `opacity ${motion.base} ${motion.ease}`,
              }}
            >
              {/* 후광 — 획을 흐리게 번지게 한 뒤 앰버로 물들여 뒤에 깐다(원본 획 위에 겹치지 않는다).
                  세 겹으로 합쳐야 가운데가 충분히 진해져 '빛나는' 느낌이 난다. */}
              {box && (
                <defs>
                  <filter id={glowId} filterUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
                    <feGaussianBlur stdDeviation={GLOW_BLUR} result="b" />
                    <feFlood floodColor={theme.palette.accent.amber} floodOpacity="1" result="c" />
                    <feComposite in="c" in2="b" operator="in" result="g" />
                    <feMerge>
                      <feMergeNode in="g" /><feMergeNode in="g" /><feMergeNode in="g" />
                    </feMerge>
                  </filter>
                </defs>
              )}
              {box && (
                <Box
                  component="g"
                  filter={`url(#${glowId})`}
                  sx={{
                    pointerEvents: 'none',
                    animation: 'memoGlowPulse 1.8s ease-in-out infinite',
                    '@keyframes memoGlowPulse': { '0%, 100%': { opacity: 0.5 }, '50%': { opacity: 1 } },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.85 },
                  }}
                >
                  {/* 후광은 색을 필터가 정하므로 검정으로 그린다. 모양은 본체와 같아야 하므로 같은 함수 */}
                  {d.strokes.map((s, i) => (
                    <StrokeShape key={`h-${i}`} keyId={`h-${i}`} ink="#000" s={{ ...s, c: '#000', w: s.w + 3 }} />
                  ))}
                </Box>
              )}
              {/* stroke 는 sx 로 팔레트 경로가 안 풀린다(MemoDraw 주석 참고) — 실제 색으로 넘긴다 */}
              {d.strokes.map((s, i) => (
                <StrokeShape key={i} keyId={String(i)} s={s} ink={theme.palette.text.primary} />
              ))}
              {/*
               * 히트 전용 그룹 — 보이지 않는 굵은 복제본. 마우스를 받는 건 여기뿐이다.
               * 획은 전부 fill:none 이라 기본 히트 폭이 선 굵기(펜 1~12px)뿐이라 잡기 어렵다.
               * pointer-events:'stroke' 는 색이 투명해도 선 자리를 잡아 준다.
               * fill:none 덕에 **네모·타원은 테두리만** 잡힌다 — 지우개가 이미 택한 규칙과 같다
               * (안쪽 빈 곳까지 잡으면 그 아래 화면을 못 쓴다).
               * 화살표는 촉 길이가 굵기에 비례해서, 부풀리면 촉이 화면을 덮는다 → 몸통(line)만 쓴다.
               */}
              <Box
                component="g"
                data-drawing-ui=""
                sx={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoverId(d.id)}
                onMouseLeave={() => setHoverId((v) => (v === d.id ? null : v))}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedId(d.id) }}
              >
                {d.strokes.map((s, i) => (
                  <StrokeShape
                    key={`hit-${i}`}
                    keyId={`hit-${i}`}
                    ink="transparent"
                    s={{ ...s, c: 'transparent', w: Math.max(s.w + 12, 18), k: s.k === 'arrow' ? 'line' : s.k }}
                  />
                ))}
              </Box>
            </Box>
          )
        })}

        {/* 선택한 그림의 도구막대 — 압정이 없어진 자리를 대신한다.
            svg 밖(레이어 직계 자식)에 둔다 — 그림 svg 안에 버튼을 넣으면 잡히지 않는다. */}
        {isMember && selectedDraw && canEditDraw && (() => {
          const b = glowBox(selectedDraw.strokes)
          if (!b) return null
          return (
            <Box
              data-drawing-ui=""
              sx={{
                // translate(-100%) 라 left 는 막대의 **오른쪽 끝**이다. 버튼 3개 = 86px 이므로
                // 왼쪽 가장자리에 그린 그림에서 막대가 레일 뒤로 숨지 않게 바닥을 둔다
                position: 'absolute', left: Math.max(b.x + b.w, 92), top: Math.max(b.y, 0),
                transform: 'translate(-100%, -100%)', pointerEvents: 'auto', zIndex: 4,
                display: 'flex', gap: 0.25, px: 0.5,
                bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                borderRadius: `${radius.pill}px`, boxShadow: shadow.lg,
              }}
            >
              <Tooltip title="그림 고치기">
                <IconButton size="small" aria-label="그림 고치기" onClick={() => { setSelectedId(null); setDrawFor(selectedDraw.id) }} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <BorderColorIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Tooltip>
              {/* 나중에 설명을 붙이는 길(사용자 지시 2026-08-06) — '그림만'으로 남겨 뒀다가
                  뒤늦게 메모를 달고 싶을 때. 그림은 그대로 두고 쪽지만 새로 만든다 */}
              {canAttachMemo && (
                <Tooltip title="메모 붙이기">
                  <IconButton size="small" aria-label="메모 붙이기" onClick={() => attachMemo(selectedDraw)} sx={{ color: 'text.secondary', p: 0.5 }}>
                    <StickyNote2Icon sx={{ fontSize: iconSize.body }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="그림 지우기">
                <IconButton size="small" aria-label="그림 지우기" onClick={() => setDelDraw(selectedDraw.id)} sx={(th) => ({ color: th.palette.accentText.red, p: 0.5 })}>
                  <DeleteOutlineIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              </Tooltip>
            </Box>
          )
        })()}

        {/* 삭제 확인은 선택 상태와 무관하게 렌더한다 — 다이얼로그 클릭이 선택을 풀어
            다이얼로그가 같이 사라지는 사고를 막는다 */}
        <ConfirmDialog
          open={delDraw !== null}
          title="이 그림을 지울까요?"
          description="화면에서 지워지고 되돌릴 수 없습니다."
          confirmLabel="지우기"
          destructive
          onClose={() => setDelDraw(null)}
          onConfirm={() => { const id = delDraw; setDelDraw(null); if (id !== null) void removeDrawing(id) }}
        />

        {/* 그리기 판 — 진입하면 쪽지는 접히고 화면 전체가 그리기 대상이 된다 */}
        {isMember && drawFor && (
          <MemoDraw
            /* key = 대상 번호 — MemoDraw 는 initial 을 처음 마운트 때만 읽는다(useState 초기값).
               key 가 없으면 대상이 바뀌어도 같은 인스턴스가 살아남아 이전 획이 그대로 남는다. */
            key={String(drawFor)}
            layerRef={layerRef}
            initial={editingDraw?.strokes}
            onDone={(strokes) => void finishDrawing(strokes)}
            onCancel={() => setDrawFor(null)}
          />
        )}

        {/* 방금 그린 그림(아직 저장 전) + 그 옆 입력창 */}
        {isMember && pending && (
          <>
            {/* 아직 저장 전인 획만 여기서 그린다 — 이미 있는 그림에 메모를 다는 중이면
                위 hereDraw 가 벌써 그리고 있어, 또 그리면 같은 자리에 두 번 겹쳐 진해진다 */}
            {!pending.existing && (
              <Box component="svg" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
                {pending.strokes.map((s, i) => (
                  <StrokeShape key={i} keyId={String(i)} s={s} ink={theme.palette.text.primary} />
                ))}
              </Box>
            )}
            <Box
              sx={(th) => ({
                position: 'absolute', left: pending.x, top: pending.y, width: NOTE_W, zIndex: 6,
                pointerEvents: 'auto', p: 1.25,
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(th.palette.accent.amber, 0.5)}`,
                borderRadius: `${radius.card}px`,
                boxShadow: shadow.lg,
              })}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                {/* 묻는 단계에서는 아직 쪽지 얘기가 아니다 — 아이콘도 그리기 쪽으로 */}
                {pending.ask
                  ? <BorderColorIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
                  : <PushPinIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />}
                <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.heavy, color: 'text.secondary' }}>
                  {pending.ask ? '메모도 함께 붙일까요?' : pending.existing ? '이 그림에 붙일 메모' : '이 그림은 무엇인가요?'}
                </Box>
              </Box>

              {pending.ask ? (
                // 선택 단계(2026-08-06 사용자 지시) — 그림만 남기고 싶을 때도 있으니 입력창을 바로 띄우지 않는다
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <Button size="small" disabled={busyPending} onClick={() => void discardPending()} sx={{ color: 'text.secondary' }}>
                    버리기
                  </Button>
                  <Button size="small" disabled={busyPending} onClick={() => void savePending(false)}>
                    {busyPending ? '붙이는 중…' : '그림만'}
                  </Button>
                  <Button size="small" variant="contained" disabled={busyPending} onClick={() => setPending({ ...pending, ask: false })}>
                    메모 쓰기
                  </Button>
                </Box>
              ) : (
                <>
                  {/* 갈래 고르기 — 기본은 일반메모. 상단바 메모 버튼과 같은 UI·같은 규칙(2026-08-06) */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1 }}>
                    <MemoKindPicker value={pendingKind} onChange={setPendingKind} disabled={busyPending} />
                    <MemoKindHint kind={pendingKind} loc={pathToLocation(pathname)} />
                  </Box>
                  <TextField
                    autoFocus fullWidth size="small" multiline minRows={2}
                    value={pendingText}
                    onChange={(e) => setPendingText(e.target.value)}
                    placeholder={pendingKind === 'plain' ? '메모 내용' : '무엇이 어떻게 불편한지 (비워도 됩니다)'}
                    disabled={busyPending}
                    slotProps={{ htmlInput: { 'aria-label': '메모 내용' } }}
                    sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size } }}
                  />
                  {/* 공유는 일반메모만 — 요청메모는 작성자+포털 관리자로 규칙이 정해져 있다.
                      그림에 붙는 메모라 여기서 고른 사람에게는 그림도 함께 보인다(사용자 지시) */}
                  {pendingKind === 'plain' && (
                    <Box sx={{ mt: 1 }}>
                      <SharePicker people={people.filter((p) => p !== user)} value={pendingShared} onChange={setPendingShared} disabled={busyPending} />
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
                    {/* 원래 있던 그림에 메모만 다는 중이면 '버리기'가 아니다 — 버릴 게 없다 */}
                    <Button size="small" disabled={busyPending} onClick={() => void discardPending()} sx={{ color: 'text.secondary' }}>
                      {pending.existing ? '취소' : '버리기'}
                    </Button>
                    <Button size="small" variant="contained" disabled={busyPending} onClick={() => void savePending(true)}>
                      {busyPending ? '붙이는 중…' : '붙이기'}
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </>
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
              user={user}
              onMoveEnd={onMoveEnd}
              defaultOpen={t.num === openNum}
            />
          )
        })}

        {/* 일반메모 — 요청메모와 같은 자리·같은 몸놀림, 다른 껍데기(2026-08-06) */}
        {hereNotes.map((n) => {
          const pos = saved?.[`n${n.id}`]
          if (!pos) return null
          return (
            <PlainNote
              key={`n${n.id}`}
              note={n}
              replies={noteReplies.filter((r) => r.noteId === n.id)}
              pos={pos}
              layerRef={layerRef}
              mine={!!user && n.author === user}
              user={user}
              people={people.filter((p) => p !== user)}
              onMoveEnd={onMoveEnd}
              onChanged={() => void reloadNotes()}
              onReplied={() => void reloadNotes()}
              defaultOpen={n.id === openNoteId}
            />
          )
        })}
      </Box>
    </Box>
  )
}
