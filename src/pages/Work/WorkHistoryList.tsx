import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import EditIcon from '@mui/icons-material/Edit'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import PostAddIcon from '@mui/icons-material/PostAdd'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import TitleIcon from '@mui/icons-material/Title'
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease'
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease'
import type { SvgIconComponent } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import type { WorkHistoryRow } from '@/api/works'
import { diffContent } from './contentDiff'
import type { DiffEntry, DiffPiece } from './contentDiff'

/**
 * 업무 변경 이력 목록 — 카드의 시계 버튼에서 펼치는 팝오버 내용(개선요청 66).
 *
 * 읽기 전용이다. 기록은 DB 트리거가 하고 앱은 손대지 않는다(docs/db/work-history.sql).
 * 소급이 안 되므로 **켠 날 이전의 변경은 없다** — 그 사실을 목록 끝에 한 줄로 알린다.
 *
 * 본문 이력은 **바뀐 곳만** 보여준다(2026-08-13 사용자 지시). 전문을 다 펼치면
 * "모두 나오긴 하는데 어디가 바뀐지 안 보이는" 상태가 된다 — 계산은 contentDiff.ts.
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

/**
 * 라벨마다 다른 아이콘 — 무슨 일이 있었는지 글자를 읽기 전에 눈에 들어오게.
 *
 * 처음엔 PlaylistAdd/PlaylistRemove/EditNote 를 썼는데 **셋 다 "가로줄 몇 개 + 작은 기호"**라
 * 16px에서 실루엣이 같아 보였다(사용자 지적 2026-08-13: "자세히 보면 다른데 알아보기 힘듦").
 * 그래서 ①윤곽이 서로 다른 모양(꽉 찬 원 · 휴지통 · 양방향 화살표)으로 바꾸고
 * ②추가·삭제에는 색을 입히고 ③크기를 액션 단으로 키웠다 — 셋을 겹쳐야 멀리서 갈린다.
 * 색만으로 구분하지는 않는다(원 안 +/− 모양이 이미 다르고, 라벨 글자가 그대로 말해 준다).
 */
const LABEL_ICON: Record<string, SvgIconComponent> = {
  '내용 추가': AddCircleIcon,
  '내용 삭제': RemoveCircleIcon,
  '내용 변경': SwapHorizIcon,
  '제목 변경': TitleIcon,
  '단계 변경': FormatIndentIncreaseIcon,
  '내용 작성': PostAddIcon,
  '내용 전체 삭제': DeleteOutlineIcon,
}

/** 라벨 아이콘 색 — 더한 쪽 초록 · 지운 쪽 빨강, 나머지는 무채색 */
const LABEL_TONE: Record<string, 'green' | 'red'> = {
  '내용 추가': 'green',
  '내용 작성': 'green',
  '내용 삭제': 'red',
  '내용 전체 삭제': 'red',
}

/** 한 번에 펼쳐 두는 항목 수 — 넘치면 접어 두고 눌러서 마저 본다 */
const PREVIEW_ENTRIES = 5

/**
 * 지운 말 / 더한 말 한 조각.
 * 색만으로 구분하지 않는다 — 지운 말에는 취소선이 함께 붙고, 줄 앞에는 아이콘이 선다.
 */
function Piece({ p }: { p: DiffPiece }) {
  if (p.mark === 'same') return <Box component="span">{p.text}</Box>
  const add = p.mark === 'add'
  return (
    <Box
      component="span"
      sx={(th) => ({
        // 12% 틴트는 토큰 주석이 대비를 보장한 값이다(tokens.ts accent 절) — 더 진하게 올리지 말 것
        bgcolor: alpha(add ? th.palette.accent.green : th.palette.accent.red, 0.12),
        color: add ? th.palette.accentText.green : th.palette.accentText.red,
        fontWeight: add ? weight.semibold : weight.regular,
        textDecoration: add ? 'none' : 'line-through',
        borderRadius: `${radius.chip}px`,
        px: '2px',
      })}
    >
      {p.text}
    </Box>
  )
}

/** 바뀐 곳 한 줄 — 왼쪽 아이콘으로 종류, 오른쪽 글에서 낱말 단위로 어디가 바뀌었는지 */
function DiffLine({ e }: { e: DiffEntry }) {
  const Icon =
    e.kind === 'add' ? AddIcon
    : e.kind === 'del' ? RemoveIcon
    : e.kind === 'indent' ? (e.indent > (e.indentFrom ?? 0) ? FormatIndentIncreaseIcon : FormatIndentDecreaseIcon)
    : EditIcon
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '15px 1fr', columnGap: 0.5, alignItems: 'start' }}>
      <Icon
        sx={(th) => ({
          fontSize: iconSize.caption,
          mt: '3px',
          color:
            e.kind === 'add' ? th.palette.accentText.green
            : e.kind === 'del' ? th.palette.accentText.red
            : th.palette.text.disabled,
        })}
      />
      {/* 줄 앞 들여쓰기(2칸 = 한 단계)를 그대로 살린다 — 어느 항목 아래의 변경인지가 이걸로 읽힌다 */}
      <Box
        sx={{
          pl: `${Math.min(e.indent, 8) * 5}px`,
          fontSize: typescale.small.size,
          lineHeight: 1.7,
          wordBreak: 'break-word',
          color: e.kind === 'del' ? 'text.secondary' : 'text.primary',
        }}
      >
        {e.pieces.map((p, i) => <Piece key={i} p={p} />)}
      </Box>
    </Box>
  )
}

/** 본문 이력 한 줄 — 라벨(무슨 일이 있었나) + 펼치면 바뀐 곳 목록 */
function BodyRow({ h }: { h: WorkHistoryRow }) {
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const d = useMemo(() => diffContent(h.prev, h.next), [h.prev, h.next])
  const Icon = LABEL_ICON[d.label]
  const tone = LABEL_TONE[d.label]
  const shown = all ? d.entries : d.entries.slice(0, PREVIEW_ENTRIES)
  const rest = d.entries.length - shown.length

  return (
    <>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {Icon && (
          <Icon
            sx={(th) => ({
              fontSize: iconSize.action,
              color: tone ? th.palette.accentText[tone] : th.palette.text.secondary,
            })}
          />
        )}
        <Box component="span" sx={{ fontWeight: weight.semibold }}>{d.label}</Box>
        {d.count > 0 && (
          <Box component="span" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {d.count}곳
          </Box>
        )}
      </Box>
      {h.author && <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}> · {h.author}</Box>}
      {d.entries.length > 0 && (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          sx={{
            ml: 0.75, p: 0, font: 'inherit', fontSize: typescale.caption.size, cursor: 'pointer',
            bgcolor: 'transparent', border: 'none', color: 'primary.main', textDecoration: 'underline',
          }}
        >
          {open ? '접기' : '바뀐 곳 보기'}
        </Box>
      )}
      {open && (
        <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {shown.map((e, i) => <DiffLine key={i} e={e} />)}
          {rest > 0 && (
            <Box
              component="button"
              type="button"
              onClick={() => setAll(true)}
              sx={{
                alignSelf: 'flex-start', p: 0, font: 'inherit', fontSize: typescale.caption.size, cursor: 'pointer',
                bgcolor: 'transparent', border: 'none', color: 'primary.main', textDecoration: 'underline',
              }}
            >
              {rest}곳 더 보기
            </Box>
          )}
        </Box>
      )}
    </>
  )
}

function Row({ h }: { h: WorkHistoryRow }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '78px 1fr', columnGap: 1.25, alignItems: 'baseline' }}>
      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
        {stamp(h.at)}
      </Box>
      <Box sx={{ minWidth: 0, fontSize: typescale.body.size, lineHeight: 1.6 }}>
        {h.field === '내용' ? (
          <BodyRow h={h} />
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
      <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.semibold, letterSpacing: '0.04em', color: 'text.disabled' }}>
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
