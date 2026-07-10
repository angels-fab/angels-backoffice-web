import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS'
import EditIcon from '@mui/icons-material/Edit'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease'
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease'
import FormatClearIcon from '@mui/icons-material/FormatClear'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { alpha } from '@mui/material/styles'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Mark, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import { COLOR_PALETTE, COLOR_LABEL, COLOR_VAR, HL_TOKENS, HL_LABEL, HL_VAR, HL_SOLID, type ColorToken, type HlToken } from '@/pages/Work/richContent'

/** 형광펜 칠하기 모드 커서 — 슬림 몸통 + 비스듬 사각(치즐) 촉, 촉 색=현재 형광펜 색. 실제 형광펜 감각 재현 */
function hlCursorCss(hex: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'>`
    + `<g transform='rotate(35 10 30)'>`
    + `<rect x='5.5' y='4' width='9' height='15' rx='2.5' fill='#2f3542' stroke='#f2f4f8' stroke-width='1.1'/>`
    + `<rect x='6.4' y='8' width='7.2' height='2.6' rx='1' fill='#dfe6f2'/>`
    + `<path d='M5.5 19 h9 v1.5 h-9 z' fill='#3a4150'/>`
    + `<path d='M5.5 20.5 L14.5 20.5 L14.5 27 L5.5 22.8 Z' fill='${hex}' stroke='rgba(0,0,0,.28)' stroke-width='0.6' stroke-linejoin='round'/>`
    + `</g></svg>`
  // 핫스팟 = 45° 촉이 회전 후 지면에 닿는 촉 끝(≈ 이미지 15,28)
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 15 28, crosshair`
}

/**
 * 업무·공지 공용 리치텍스트 — 마크(글자색·형광펜) + 목록 확장 + 공용 툴바.
 * 두 에디터(RichContentEditor·NoticeBodyEditor)가 동일 기능·동일 툴바를 공유한다.
 */

// ── 글자색 토큰(raw hex 아님) — <span data-color="red" class="wc-color">, CSS가 테마색 적용 ──
export const ColorTokenMark = Mark.create({
  name: 'colorToken',
  addAttributes() {
    return {
      token: {
        default: 'default',
        parseHTML: (el) => el.getAttribute('data-color') || 'default',
        renderHTML: (attrs) => (attrs.token && attrs.token !== 'default' ? { 'data-color': attrs.token } : {}),
      },
    }
  },
  parseHTML() { return [{ tag: 'span[data-color]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ class: 'wc-color' }, HTMLAttributes), 0] },
})

// ── 형광펜(하이라이트) — 다색 토큰, <mark class="wc-hl" data-color="…">, CSS가 테마 배경 적용 ──
export const HighlightTokenMark = Mark.create({
  name: 'highlightToken',
  addAttributes() {
    return {
      token: {
        default: 'yellow',
        parseHTML: (el) => el.getAttribute('data-color') || 'yellow',
        renderHTML: (attrs) => (attrs.token && attrs.token !== 'yellow' ? { 'data-color': attrs.token } : {}),
      },
    }
  },
  parseHTML() { return [{ tag: 'mark' }] },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes({ class: 'wc-hl' }, HTMLAttributes), 0] },
})

/** 목록 확장(글머리·번호·항목) — Tab/Shift-Tab 들여쓰기·자동 이어쓰기 포함(ListItem 기본 키맵) */
export const listExtensions = [BulletList, OrderedList, ListItem]

/**
 * 툴바 힌트 툴팁 — 버튼 위(placement top)로 떠서 아래 본문을 가리지 않고,
 * 클릭(mousedown)하면 즉시 사라지며, 버튼에서 벗어나면 바로 닫힌다(interactive 아님·leave 0).
 * span 래퍼가 disabled 버튼의 이벤트도 받는다.
 */
function HintTip({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip title={title} open={open} placement="top" disableInteractive
      enterDelay={350} leaveDelay={0} onClose={() => setOpen(false)}
      // flip 비활성 = 위 공간이 좁아도 아래로 안 뒤집힘 → 항상 툴바 위, 본문 텍스트를 가리지 않음
      slotProps={{ popper: { modifiers: [{ name: 'flip', enabled: false }] } }}>
      <Box
        component="span"
        sx={{ display: 'inline-flex' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onMouseDown={() => setOpen(false)}
      >
        {children}
      </Box>
    </Tooltip>
  )
}

// 툴바 버튼(선택 유지 위해 mousedown 기본동작 차단)
function TBtn({ active, disabled, title, onClick, children }: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <HintTip title={title}>
      <IconButton
        size="small"
        aria-label={title}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        sx={(th) => ({
          p: 0.4, borderRadius: '7px',
          color: active ? th.palette.primary.main : 'text.secondary',
          bgcolor: active ? alpha(th.palette.primary.main, 0.16) : 'transparent',
          '&:hover': { bgcolor: alpha(th.palette.primary.main, active ? 0.22 : 0.1) },
        })}
      >
        {children}
      </IconButton>
    </HintTip>
  )
}

/**
 * PPT식 스플릿 버튼 — 본버튼(글리프 + 마지막 색 바) 클릭 = 즉시 적용, ▾(밀착) = 팔레트.
 * 글자색·형광펜이 공유. 두 버튼은 한 그룹으로 붙어 보임.
 */
function SplitBtn({ title, glyph, barColor, active, onApply, onOpen }: {
  title: string; glyph: React.ReactNode; barColor: string; active?: boolean; onApply: () => void; onOpen: (el: HTMLElement) => void
}) {
  // 팔레트는 화살표가 아니라 본체(글리프) 아래에서 열리게 — 앵커를 본체 버튼으로
  const mainRef = useRef<HTMLButtonElement>(null)
  return (
    // 호버 강조는 컨트롤 전체(본체+화살표)에 한 번에 — PPT처럼 한 덩어리로 반응
    <Box sx={(th) => ({
      display: 'inline-flex', alignItems: 'stretch', borderRadius: '7px', overflow: 'hidden',
      bgcolor: active ? alpha(th.palette.primary.main, 0.16) : 'transparent',
      '&:hover': { bgcolor: alpha(th.palette.primary.main, active ? 0.22 : 0.1) },
    })}>
      <HintTip title={title}>
        <IconButton ref={mainRef} size="small" aria-label={title} aria-pressed={active} onMouseDown={(e) => e.preventDefault()} onClick={onApply}
          sx={{ p: '3px 4px', borderRadius: 0, color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            {/* 글리프 고정 높이 박스 — '가'/아이콘 높이가 달라도 아래 색상 바가 같은 높이에 정렬되게 */}
            <Box sx={{ height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{glyph}</Box>
            <Box sx={{ width: 15, height: 3, borderRadius: '1px', mt: '2px', bgcolor: barColor }} />
          </Box>
        </IconButton>
      </HintTip>
      <HintTip title={`${title} 선택`}>
        <IconButton size="small" aria-label={`${title} 선택`} aria-haspopup="menu" onMouseDown={(e) => e.preventDefault()} onClick={() => mainRef.current && onOpen(mainRef.current)}
          sx={{ p: 0, width: 15, borderRadius: 0, color: 'text.secondary' }}>
          <ArrowDropDownIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </HintTip>
    </Box>
  )
}

/**
 * 공용 서식 툴바 — 굵게·기울임·밑줄·취소선 | 글자색·형광펜(PPT식 스플릿) | 글머리·번호·들여쓰기·내어쓰기 | 서식제거.
 * editor가 null이면 렌더 안 함. 색상 메뉴 상태는 내부 관리.
 */
export function RichToolbar({ editor }: { editor: Editor | null }) {
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null)
  const [hlAnchor, setHlAnchor] = useState<HTMLElement | null>(null)
  // PPT식 — 마지막 사용 색 기억, 본버튼 클릭=바로 적용, ▾만 팔레트
  const [lastColor, setLastColor] = useState<ColorToken>('red')
  const [lastHl, setLastHl] = useState<HlToken>('yellow')
  // 형광펜 칠하기 모드 — 선택 없이 형광펜을 켜면 유지되고, 텍스트를 드래그할 때마다 칠해진다(PPT). 재클릭·Esc로 해제
  const [hlMode, setHlMode] = useState(false)

  useEffect(() => {
    if (!editor || !hlMode) return
    const dom = editor.view.dom as HTMLElement
    // 모드 동안 마커 커서(촉 색=현재 형광펜 색) — 실제 형광펜으로 긋는 감각
    const prevCursor = dom.style.cursor
    dom.style.cursor = hlCursorCss(HL_SOLID[lastHl])
    const onUp = () => {
      // mouseup 직후 DOM 선택을 PM 좌표로 직접 변환해 칠하고 선택 해제(연속 칠하기) — PM sync 타이밍에 안 기댐
      window.setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
        const r = sel.getRangeAt(0)
        if (!dom.contains(r.commonAncestorContainer)) return
        let from = -1, to = -1
        try { from = editor.view.posAtDOM(r.startContainer, r.startOffset); to = editor.view.posAtDOM(r.endContainer, r.endOffset) } catch { return }
        if (from < 0 || to < 0 || from === to) return
        const [a, b] = from < to ? [from, to] : [to, from]
        editor.chain().focus().setTextSelection({ from: a, to: b }).setMark('highlightToken', { token: lastHl }).setTextSelection(b).run()
      }, 0)
    }
    // Esc = 모드만 해제 — capture+stopPropagation으로 폼 닫기 등 다른 Esc 동작보다 우선(모드 중일 때만 이 리스너가 존재)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setHlMode(false) } }
    dom.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey, true)
    return () => {
      dom.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey, true)
      dom.style.cursor = prevCursor
    }
  }, [editor, hlMode, lastHl])

  if (!editor) return null

  const curColor: ColorToken = (editor.isActive('colorToken') ? editor.getAttributes('colorToken').token : 'default') as ColorToken
  const curHl: HlToken | null = editor.isActive('highlightToken') ? ((editor.getAttributes('highlightToken').token || 'yellow') as HlToken) : null
  const canSink = editor.can().sinkListItem('listItem')
  const canLift = editor.can().liftListItem('listItem')

  const applyColor = (token: ColorToken) => {
    const chain = editor.chain().focus()
    if (token === 'default') chain.unsetMark('colorToken').run()
    else chain.setMark('colorToken', { token }).run()
    setLastColor(token)
    setColorAnchor(null)
  }
  // 형광펜 — 선택이 있으면 그 자리에서 한 번 칠하기(딸깍), 없으면 칠하기 모드 유지. '색 없음'은 mark만 제거(모드·마지막 색 불변)
  const applyHl = (token: HlToken | 'none') => {
    if (token === 'none') {
      editor.chain().focus().unsetMark('highlightToken').run()
      setHlAnchor(null)
      return
    }
    setLastHl(token)
    if (editor.state.selection.empty) { setHlMode(true); editor.chain().focus().run() } // 포커스 복귀 — 이후 드래그 선택이 에디터에 잡히게
    else editor.chain().focus().setMark('highlightToken', { token }).run()
    setHlAnchor(null)
  }
  const onHlBody = () => {
    if (editor.state.selection.empty) { setHlMode((m) => !m); editor.chain().focus().run() }
    else applyHl(lastHl)
  }

  return (
    <Box
      onMouseDown={(e) => e.preventDefault()}
      sx={(th) => ({
        display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap',
        mb: 0.5, px: 0.5, py: 0.25, borderRadius: '8px',
        border: '1px solid', borderColor: th.palette.divider,
        bgcolor: alpha(th.palette.text.primary, 0.04),
      })}
    >
      <TBtn title="굵게 (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <FormatBoldIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="기울임 (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <FormatItalicIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="밑줄 (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <FormatUnderlinedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughSIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      {/* 글자색 — 커서 위치에 따른 선택효과 없음(클릭 딸깍 + 색 적용만). 바=마지막 사용 색 */}
      <SplitBtn
        title={`글자색 (${COLOR_LABEL[lastColor]})`}
        glyph={<Box component="span" sx={{ fontSize: 11.5, fontWeight: 800, color: 'text.secondary' }}>가</Box>}
        // 기본 글자색이면 실제 기본 글자색(중립)을 바에 그대로 — 비활성처럼 흐려 보이지 않게
        barColor={lastColor === 'default' ? 'text.primary' : COLOR_VAR[lastColor]}
        onApply={() => applyColor(lastColor)}
        onOpen={setColorAnchor}
      />
      {/* 형광펜 — 선택효과 = 칠하기 모드일 때만(커서 위치와 무관) */}
      <SplitBtn
        title={hlMode ? `형광펜 칠하기 모드 (${HL_LABEL[lastHl]}) — 드래그하면 칠해짐, 재클릭·Esc 해제` : `형광펜 (${HL_LABEL[lastHl]})`}
        glyph={<EditIcon sx={{ fontSize: 12.5 }} />}
        // 글자색 바와 동일 스타일 — 불투명 색(HL_SOLID)으로 두께·선명도 정렬(HL_VAR은 반투명이라 얇아 보임)
        barColor={HL_SOLID[lastHl]}
        active={hlMode}
        onApply={onHlBody}
        onOpen={setHlAnchor}
      />

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      <TBtn title="글머리 목록" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <FormatListBulletedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <FormatListNumberedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="들여쓰기 (Tab)" disabled={!canSink} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
        <FormatIndentIncreaseIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="내어쓰기 (Shift+Tab)" disabled={!canLift} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
        <FormatIndentDecreaseIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      <TBtn title="서식 제거" onClick={() => {
        editor.chain().focus().unsetAllMarks().run()
        // 커서만 있을 때는 대기 중(storedMarks) 서식도 비움 — unsetAllMarks는 빈 선택에서 no-op이라 방금 고른 색이 남는 것 방지
        if (editor.state.selection.empty) editor.view.dispatch(editor.state.tr.setStoredMarks([]))
      }}>
        <FormatClearIcon sx={{ fontSize: 18 }} />
      </TBtn>

      {/* 글자색 팔레트 — 본체('가') 아래, 이름 없이 1행 5열 네모 스와치(기본·빨강·노랑·초록·파랑) */}
      <Menu
        anchorEl={colorAnchor}
        open={Boolean(colorAnchor)}
        onClose={() => setColorAnchor(null)}
        slotProps={{ list: { dense: true, sx: SWATCH_ROW_SX, onMouseDown: (e: React.MouseEvent) => e.preventDefault() } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {COLOR_PALETTE.map((tk) => (
          <MenuItem key={tk} onClick={() => applyColor(tk)} aria-label={COLOR_LABEL[tk]} disableGutters sx={SWATCH_ITEM_SX}>
            <Box
              component="span"
              sx={(th) => ({
                ...SWATCH_BOX,
                // 기본 글자색 = 실제 기본색(밝은 텍스트) 네모, 나머지는 해당 색
                bgcolor: tk === 'default' ? th.palette.text.primary : COLOR_VAR[tk],
                boxShadow: curColor === tk ? `0 0 0 2px ${th.palette.primary.main}` : `inset 0 0 0 1px ${alpha(th.palette.common.black, 0.25)}`,
              })}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* 형광펜 팔레트 — 본체(펜) 아래, 이름 없이 1행 5열 네모(노랑·초록·파랑·분홍·색없음) */}
      <Menu
        anchorEl={hlAnchor}
        open={Boolean(hlAnchor)}
        onClose={() => setHlAnchor(null)}
        slotProps={{ list: { dense: true, sx: SWATCH_ROW_SX, onMouseDown: (e: React.MouseEvent) => e.preventDefault() } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {HL_TOKENS.map((tk) => (
          <MenuItem key={tk} onClick={() => applyHl(tk)} aria-label={HL_LABEL[tk]} disableGutters sx={SWATCH_ITEM_SX}>
            <Box component="span" sx={(th) => ({ ...SWATCH_BOX, bgcolor: HL_VAR[tk], boxShadow: curHl === tk ? `0 0 0 2px ${th.palette.primary.main}` : `inset 0 0 0 1px ${alpha(th.palette.common.black, 0.25)}` })} />
          </MenuItem>
        ))}
        {/* 색 없음 = 형광펜 mark만 제거(글자색·마지막 색 불변) — 빨간 사선 네모 */}
        <MenuItem onClick={() => applyHl('none')} aria-label="색 없음" disableGutters sx={SWATCH_ITEM_SX}>
          <Box component="span" sx={(th) => ({
            ...SWATCH_BOX, bgcolor: 'transparent', boxShadow: `inset 0 0 0 1px ${th.palette.text.secondary}`, position: 'relative', overflow: 'hidden',
            '&::after': { content: '""', position: 'absolute', top: '50%', left: '-20%', width: '140%', height: '1.5px', bgcolor: th.palette.error.main, transform: 'rotate(-45deg)' },
          })} />
        </MenuItem>
      </Menu>
    </Box>
  )
}

// 팔레트 공용 스타일 — 가로 1행 네모 스와치
const SWATCH_ROW_SX = { display: 'flex', flexDirection: 'row', gap: 0.5, p: 0.5 } as const
const SWATCH_ITEM_SX = { p: '3px', minWidth: 0, minHeight: 0, borderRadius: '6px' } as const
const SWATCH_BOX = { display: 'block', width: 20, height: 20, borderRadius: '4px', flexShrink: 0, boxSizing: 'border-box' } as const

// 초기 콘텐츠 — HTML이면 그대로, 평문이면 줄바꿈→문단(기존 평문 데이터 호환)
const bodyToContent = (body: string): string => {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|u|s|a|h[1-6]|span|mark)\b/i.test(s)
  if (looksHTML) return s
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p></p>')).join('') || '<p></p>'
}

export interface RichBodyEditorProps {
  /** 초기 본문(HTML 또는 평문). 마운트 1회만 사용 — 이후엔 에디터가 자체 관리 */
  value: string
  /** 변경 시 HTML 반환(비면 '') */
  onChange: (html: string) => void
  placeholder?: string
  ariaLabel?: string
  fontSize?: number
  minHeight?: number
  /** true면 인풋처럼 테두리 박스로 감쌈(개선요청·답글·코멘트), false면 맨몸(공지) */
  framed?: boolean
  /** Ctrl/Cmd+Enter 콜백(코멘트 저장 등) */
  onCtrlEnter?: () => void
}

/**
 * 공용 리치 본문 에디터(HTML in/out) — 공지·포털개선요청(게시글/답글)·데모 코멘트가 공유.
 * RichToolbar 항상 표시. 저장은 getHTML() → 표시는 utils/richBody의 RichBodyView.
 */
export function RichBodyEditor({ value, onChange, placeholder, ariaLabel, fontSize = 13, minHeight = 64, framed = false, onCtrlEnter }: RichBodyEditorProps) {
  const editor = useEditor({
    extensions: [
      Document, Paragraph, Text,
      // Highlight를 Color보다 먼저 = 형광펜 mark가 바깥, 글자색이 안쪽 → 형광펜 위에서도 글자색 유지
      Bold, Italic, Underline, Strike, HighlightTokenMark, ColorTokenMark,
      ...listExtensions, History,
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: bodyToContent(value),
    editorProps: { attributes: { class: 'rb-editor', role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel || '내용' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
  })

  if (!editor) return null

  return (
    // framed = 인풋풍 테두리 박스가 툴바+본문을 함께 감쌈(서식툴이 작성란 내부에 위치)
    <Box
      onKeyDown={(e) => { if (onCtrlEnter && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onCtrlEnter() } }}
      sx={(th) => ({
        width: '100%',
        ...(framed && {
          bgcolor: alpha(th.palette.text.primary, 0.05),
          border: '1px solid', borderColor: th.palette.divider, borderRadius: '8px',
          px: 1, py: '6px',
          '&:focus-within': { borderColor: th.palette.accent?.green || th.palette.primary.main },
        }),
      })}
    >
      <RichToolbar editor={editor} />
      <Box
        sx={{
          '& .ProseMirror': {
            minHeight, outline: 'none', fontSize, lineHeight: 1.65, color: 'text.primary',
            wordBreak: 'break-word', overflowWrap: 'anywhere',
            '& p': { m: 0, mb: 0.25 },
            '& p:last-child': { mb: 0 },
            '& ul, & ol': { pl: '18px', m: 0, mb: 0.25 },
            '& ul': { listStyle: 'disc' },
            '& ol': { listStyle: 'decimal' },
            '& li': { m: '1px 0' },
            '& li p': { m: 0 },
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)', color: 'text.disabled', float: 'left', height: 0, pointerEvents: 'none',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}
