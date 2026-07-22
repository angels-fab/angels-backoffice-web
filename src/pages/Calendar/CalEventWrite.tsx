import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Popper from '@mui/material/Popper'
import Grow from '@mui/material/Grow'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Dialog from '@mui/material/Dialog'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CloseIcon from '@mui/icons-material/Close'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import RepeatIcon from '@mui/icons-material/Repeat'
import GroupsIcon from '@mui/icons-material/Groups'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import FlightIcon from '@mui/icons-material/Flight'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import { alpha } from '@mui/material/styles'
import { addCalEvent, updateCalEvent, deleteCalEvent, type CalScope } from '@/api/calendar'
import { useRole } from '@/auth/role'
import type { CalEvent } from '@/types'
import { MEMBERS, given, eventParticipants } from './members'
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'
import { iconSize, radius } from '@/theme/tokens'
import { ConfirmDialog } from '@/components/ds'
import { todaySeoul } from '@/utils/date'

// 제목에서 '@참석자' 부분을 뗀 기본 제목([구분]·내용) — 참석자는 별도 피커가 관리
const baseTitle = (t: string): string => {
  const at = (t || '').indexOf('@')
  return (at >= 0 ? t.slice(0, at) : t).trim()
}
const memberColor = (name: string): string => MEMBERS.find((m) => m.name === name)?.color ?? 'var(--text3)'

// 종류 선택 시 제목 앞에 붙일 표준 태그 — calSlice.classify()가 그대로 인식하는 문구
// ([국내출장]/[국외출장]은 '출장' 매칭 + 국외 판별까지 한 번에 통과)
const STD_TAG: Record<RealCat, string> = {
  meeting: '회의', work: '업무', edu: '교육',
  trip_dom: '국내출장', trip_intl: '국외출장',
  recruit: '기타', leave: '연차', etc: '기타',
}

// 종류칩 아이콘 — CalFilterBar·ChipContent와 동일 매핑(한 벌 유지)
const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon, work: WorkIcon, edu: SchoolIcon,
  recruit: MoreHorizIcon, trip_dom: DirectionsCarIcon, trip_intl: FlightIcon,
  leave: BeachAccessIcon, etc: MoreHorizIcon,
}

/** 기본 제목에서 선두 [구분] 태그 분리 + 종류 판별(calSlice.classify와 동일 규칙) — 수정 프리필용 */
function parseTitleTag(base: string): { cat: RealCat | null; tag: string | null; content: string } {
  const m = (base || '').match(/^\s*\[([^\]]+)\]\s*/)
  if (!m) return { cat: null, tag: null, content: (base || '').trim() }
  const tag = m[1]
  const content = base.slice(m[0].length).trim()
  let cat: RealCat | null = null
  if (/연차|반차|휴가|사가/.test(tag)) cat = 'leave'
  else if (/회의|미팅|보고|위원회/.test(tag)) cat = 'meeting'
  else if (/업무/.test(tag)) cat = 'work'
  else if (/교육|세미나|워크숍|강의/.test(tag)) cat = 'edu'
  else if (/출장|실사|방문/.test(tag)) cat = /국외|해외/.test(base) ? 'trip_intl' : 'trip_dom'
  else cat = 'etc'
  return { cat, tag, content }
}

// 종류 픽커에 노출할 순서 — CAT_ORDER에서 채용(recruit) 제외(필터 미노출과 동일 정책)
const PICK_CATS: RealCat[] = CAT_ORDER.filter((c) => c !== 'recruit')

/** 그리드 미리보기(막대)용 초안 — 부모가 임시 일정으로 달력에 그린다(add 모드에서만 전달) */
export interface CalDraft {
  start: string
  end: string
  title: string
}

interface Props {
  open: boolean
  mode: 'add' | 'edit'
  /** edit 모드의 대상 일정 */
  event: CalEvent | null
  /** add 모드에서 미리 채울 시작일 (선택한 날) */
  initialDate: string
  /** add 모드 종료일 프리필 — 범위 드래그 선택 시. 없으면 시작일과 동일 */
  initialEndDate?: string
  onClose: () => void
  /** 추가/수정/삭제 성공 → 부모가 새로고침 (안내 메시지 전달) */
  onSaved: (msg: string) => void
  /** add 모드 날짜·제목 변경을 부모에 알림 — 달력 위 '(새 일정)' 막대 미리보기용(선택) */
  onDraftChange?: (draft: CalDraft | null) => void
}

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly_nth' | 'monthly_last' | 'yearly'
const ORDINALS = ['첫번째', '두번째', '세번째', '네번째', '다섯번째']

const dateOnly = (dt: string) => (dt || '').slice(0, 10)
const timeOnly = (dt: string) => (dt || '').slice(11, 16)
const pad2 = (n: number) => String(n).padStart(2, '0')

// 종일 일정의 종료는 '미포함'(다음 날 0시)이라, 화면 표시용 마지막 날 = end - 1일
function inclusiveEndDate(endDt: string): string {
  const m = (endDt || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ── 날짜 문자열(yyyy-MM-dd) 유틸 — 미니 달력용 ──
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const dowOf = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))).getDay()
/** '7월 29일 (수)' — 같은 해 표기 생략. sameMonthOf가 있으면 그 달과 같을 때 '29일 (수)'로 축약 */
function fmtK(key: string, sameMonthOf?: string): string {
  if (!key) return ''
  const m = Number(key.slice(5, 7))
  const d = Number(key.slice(8, 10))
  const w = WEEKDAYS[dowOf(key)]
  if (sameMonthOf && key.slice(0, 7) === sameMonthOf.slice(0, 7)) return `${d}일 (${w})`
  return `${m}월 ${d}일 (${w})`
}
const dayDiff = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

/**
 * 시작일에서 파생되는 반복 옵션(구글캘린더식) — 매일 / 매주 X요일 / 매월 N번째 X요일 /
 * 매월 마지막 X요일(그 달의 마지막 해당 요일일 때만) / 매년 M월 D일.
 */
function repeatOptions(dateKey: string): { value: Repeat; label: string }[] {
  const opts: { value: Repeat; label: string }[] = [
    { value: 'none', label: '반복 안 함' },
    { value: 'daily', label: '매일' },
  ]
  if (!dateKey) return [...opts, { value: 'weekly', label: '매주' }]
  const m = Number(dateKey.slice(5, 7))
  const d = Number(dateKey.slice(8, 10))
  const w = WEEKDAYS[dowOf(dateKey)]
  const nth = Math.ceil(d / 7)
  const daysInMonth = new Date(Number(dateKey.slice(0, 4)), m, 0).getDate()
  opts.push({ value: 'weekly', label: `매주 ${w}요일` })
  // N번째는 항상 병기(다섯번째는 그 요일이 5번 있는 달에만 생성), 마지막은 그 달의 마지막 해당 요일일 때만
  opts.push({ value: 'monthly_nth', label: `매월 ${ORDINALS[nth - 1]} ${w}요일` })
  if (d + 7 > daysInMonth) opts.push({ value: 'monthly_last', label: `매월 마지막 ${w}요일` })
  opts.push({ value: 'yearly', label: `매년 ${m}월 ${d}일` })
  return opts
}

/**
 * 미니 달력 — 숙소예약식 클릭-클릭 기간 선택(사용자 확정).
 * 한 번=시작일(종료 대기), 한 번 더=종료일. 같은 날 두 번=하루. 시작보다 앞을 누르면 구간을 뒤집어 잡는다.
 */
function MiniCalendar({ ym, onYm, start, end, picking, onPick }: {
  ym: string // 표시 중인 달 'yyyy-MM'
  onYm: (next: string) => void
  start: string
  end: string // ''=하루
  picking: boolean
  onPick: (dayKey: string) => void
}) {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  const firstDow = new Date(y, m - 1, 1).getDay()
  const days = new Date(y, m, 0).getDate()
  const endEff = end || start
  const today = todaySeoul()
  const move = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1)
    onYm(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }
  const bandSx = { position: 'absolute' as const, top: 4, bottom: 4, left: 0, right: 0, bgcolor: 'rgba(84,145,218,.2)' }
  const n = start && endEff ? dayDiff(start, endEff) + 1 : 1
  return (
    <Box sx={{ bgcolor: 'background.elevated', border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, p: '10px 12px 8px', width: 306, maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '2px', pb: 0.75 }}>
        <IconButton size="small" aria-label="이전 달" onClick={() => move(-1)} sx={{ color: 'text.secondary' }}><ChevronLeftIcon sx={{ fontSize: 18 }} /></IconButton>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{y}년 {m}월</Typography>
        <IconButton size="small" aria-label="다음 달" onClick={() => move(1)} sx={{ color: 'text.secondary' }}><ChevronRightIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {WEEKDAYS.map((w, i) => (
          <Box key={w} sx={{ fontSize: 10.5, fontWeight: 700, textAlign: 'center', pb: '5px', color: i === 0 ? 'error.main' : i === 6 ? 'primary.main' : 'text.disabled' }}>{w}</Box>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <Box key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1
          const key = `${ym}-${pad2(d)}`
          const inRange = start && key >= start && key <= endEff
          const isStart = key === start
          const isEnd = key === endEff
          const single = start === endEff
          return (
            <Box
              key={key}
              component="button"
              type="button"
              onClick={() => onPick(key)}
              aria-label={`${m}월 ${d}일`}
              sx={{
                position: 'relative', height: 34, border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', p: 0,
                '&:hover [data-num]': { bgcolor: 'action.hover', borderRadius: '50%' },
              }}
            >
              {inRange && (
                <Box sx={{
                  ...bandSx,
                  ...(single ? { left: '12%', right: '12%', borderRadius: '14px' }
                    : isStart ? { left: '12%', borderRadius: '14px 0 0 14px' }
                    : isEnd ? { right: '12%', borderRadius: '0 14px 14px 0' }
                    : null),
                }} />
              )}
              <Box data-num sx={{
                position: 'relative', zIndex: 1, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12.5, fontVariantNumeric: 'tabular-nums', borderRadius: '50%',
                color: 'text.secondary',
                ...(key === today ? { boxShadow: (th) => `inset 0 0 0 1px ${th.palette.primary.main}` } : null),
                ...((isStart || isEnd) && start ? { bgcolor: 'primary.main', color: 'common.white', fontWeight: 700 } : null),
              }}>
                {d}
              </Box>
            </Box>
          )
        })}
      </Box>
      <Box sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', pt: '7px', mt: '4px', borderTop: 1, borderColor: 'divider' }}>
        {picking
          ? <>종료일을 누르세요 <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>(같은 날 = 하루)</Box></>
          : n > 1 ? `${n}일 일정 — 다시 누르면 새로 선택` : '하루 일정 — 다시 누르면 새로 선택'}
      </Box>
    </Box>
  )
}

/** 아이콘이 라벨을 대신하는 폼 행 — 구글캘린더식(제목 아래 언제/반복/누구/어디 스택) */
function FieldRow({ icon, wrap, children }: { icon: ReactNode; wrap?: boolean; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1.1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}>
      <Box sx={{ display: 'flex', color: 'text.disabled', flex: 'none', '& svg': { fontSize: 20 } }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</Box>
    </Box>
  )
}

/** 기간·시간 칩 — 누르면 미니팝업 피커가 열리는 요약 버튼 */
function SummaryChip({ label, active, ariaLabel, onClick }: { label: ReactNode; active?: boolean; ariaLabel: string; onClick: (e: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={!!active}
      sx={(th) => ({
        display: 'inline-flex', alignItems: 'center', gap: 0.75, fontFamily: 'inherit', cursor: 'pointer',
        bgcolor: 'background.elevated', border: 1, borderColor: active ? 'primary.main' : 'divider',
        borderRadius: `${radius.chip}px`, px: 1.5, py: '6px', fontSize: 13, fontWeight: 600, color: 'text.primary',
        whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', transition: 'border-color .15s, box-shadow .15s',
        ...(active ? { boxShadow: `0 0 0 3px ${alpha(th.palette.primary.main, 0.22)}` } : null),
        '&:hover': { borderColor: active ? 'primary.main' : th.palette.text.disabled },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      })}
    >
      {label}
    </Box>
  )
}

/**
 * 24시간제 시간 목록 컬럼 — 휠 스크롤·클릭 선택(15분 간격), 열릴 때 선택값을 가운데로.
 * 목록에 없는 값(구글 동기화 일정의 임의 분 등)은 제자리에 끼워 그대로 보존한다.
 */
function TimeColumn({ label, value, onPick }: { label: string; value: string; onPick: (v: string) => void }) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const opts: string[] = []
  for (let h = 0; h < 24; h++) for (const mm of ['00', '15', '30', '45']) opts.push(`${pad2(h)}:${mm}`)
  if (value && !opts.includes(value)) { opts.push(value); opts.sort() }
  useEffect(() => {
    const list = listRef.current
    const sel = list?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (list && sel) list.scrollTop = sel.offsetTop - (list.clientHeight - sel.offsetHeight) / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 팝업이 열릴 때 1회만 — 이후 선택은 스크롤 위치 유지
  return (
    <Box>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontWeight: 700, textAlign: 'center', pb: 0.5 }}>{label}</Typography>
      <Box ref={listRef} data-timelist="" sx={{ position: 'relative', width: 88, height: 216, overflowY: 'auto', overscrollBehavior: 'contain', borderRadius: `${radius.input}px` }}>
        {opts.map((t) => {
          const on = t === value
          return (
            <Box
              key={t}
              component="button"
              type="button"
              onClick={() => onPick(t)}
              aria-pressed={on}
              sx={{
                display: 'block', width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                py: '5px', fontSize: 13, fontVariantNumeric: 'tabular-nums', textAlign: 'center', borderRadius: `${radius.input}px`,
                ...(on
                  ? { bgcolor: 'primary.main', color: 'common.white', fontWeight: 700 }
                  : { bgcolor: 'transparent', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }),
              }}
            >
              {t}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/**
 * 캘린더 일정 추가/수정/삭제 모달 — 구글캘린더식 컴팩트 폼 v2(사용자 확정).
 * 제목이 주인공, 종류=아이콘 원(선택 시 가로 확장 + 이름), 기간=칩+미니달력 클릭-클릭(숙소예약식),
 * 시간=칩+펼침 피커(잘림 없음). 반복 일정의 수정·삭제는 범위 선택(이 일정만/이후/전체)을 먼저 묻는다.
 */
export default function CalEventWrite({ open, mode, event, initialDate, initialEndDate, onClose, onSaved, onDraftChange }: Props) {
  const { user, isAdmin } = useRole()
  const [title, setTitle] = useState('') // 내용 제목 — [구분] 태그·@참석자 제외(둘 다 별도 피커가 관리)
  const [attendees, setAttendees] = useState<string[]>([]) // 참석자 이름들(제목 @뒤로 합쳐 저장)
  const [cat, setCat] = useState<RealCat | null>(null) // 일정 종류 — 선택 시 제목 앞 [태그]로 저장
  const [origTag, setOrigTag] = useState<string | null>(null) // 수정 시 원본 태그(종류 안 바꾸면 원문 보존)
  const [origCat, setOrigCat] = useState<RealCat | null>(null)
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState('') // 시작일
  const [endDate, setEndDate] = useState('') // 종료일(''=시작일과 같은 하루)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [loc, setLoc] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopeAsk, setScopeAsk] = useState<null | 'save' | 'delete'>(null) // 반복 시리즈 범위 선택 대기
  const [delAsk, setDelAsk] = useState(false) // 단일 일정 삭제 확인(표준 ConfirmDialog)
  // 기간/시간 피커 — 칩에 붙는 미니팝업(모달 크기 불변, 사용자 확정). 날짜는 그리드에서 이미 정했으니 기본 닫힘.
  const [calAnchor, setCalAnchor] = useState<HTMLElement | null>(null)
  const [timeAnchor, setTimeAnchor] = useState<HTMLElement | null>(null)
  const [repeatAnchor, setRepeatAnchor] = useState<HTMLElement | null>(null) // 반복 드롭다운 — 피커와 동일한 미니팝업
  const [picking, setPicking] = useState(false) // 미니달력: 시작 찍고 종료 대기 중
  const [calYm, setCalYm] = useState('') // 미니달력 표시 달 'yyyy-MM'

  const isSeries = !!(event && event.seriesId) // 반복 시리즈의 한 발생일(materialize) — 수정/삭제 시 범위 선택
  const draftSkip = useRef(false) // 재열림 직후 초안 effect의 stale 1회 실행 스킵(리셋 effect가 신선한 초안을 직접 보냄)

  // 열릴 때마다 폼 초기화 (add: 선택일 / edit: 대상 일정 값 — 반복 일정은 시리즈 원본을 불러 프리필)
  useEffect(() => {
    if (!open) return
    // 같은 패스에서 뒤따르는 초안 effect는 아직 이전 세션 상태를 읽으므로 스킵시키고, 여기서 신선한 값으로 직접 알림
    draftSkip.current = true
    if (onDraftChange) {
      if (mode === 'add' && initialDate) {
        const e0 = initialEndDate && initialEndDate !== initialDate ? initialEndDate : initialDate
        onDraftChange({ start: initialDate, end: e0, title: '' })
      } else {
        onDraftChange(null)
      }
    }
    setError(null)
    setBusy(false)
    setScopeAsk(null)
    setDelAsk(false)
    setRepeat('none')
    setPicking(false)
    setCalAnchor(null)
    setTimeAnchor(null)
    setRepeatAnchor(null)
    if (mode === 'edit' && event) {
      const parsed = parseTitleTag(baseTitle(event.title))
      setTitle(parsed.content)
      setCat(parsed.cat)
      setOrigTag(parsed.tag)
      setOrigCat(parsed.cat)
      setAttendees(eventParticipants(event.title))
      setAllDay(event.allDay)
      setDate(dateOnly(event.start))
      setLoc(event.loc && event.loc !== '-' ? event.loc : '')
      setCalYm(dateOnly(event.start).slice(0, 7))
      if (event.allDay) {
        const inc = inclusiveEndDate(event.end)
        setEndDate(inc && inc !== dateOnly(event.start) ? inc : '')
      } else {
        setStartTime(timeOnly(event.start) || '09:00')
        setEndTime(timeOnly(event.end) || '10:00')
        const e0 = dateOnly(event.end)
        setEndDate(e0 && e0 !== dateOnly(event.start) ? e0 : '')
      }
    } else {
      setTitle('')
      setCat(null)
      setOrigTag(null)
      setOrigCat(null)
      setAttendees([])
      setAllDay(false)
      setDate(initialDate || '')
      setEndDate(initialEndDate && initialEndDate !== initialDate ? initialEndDate : '')
      if (initialEndDate && initialEndDate !== initialDate) setAllDay(true) // 범위 드래그 = 종일 구간 일정
      setStartTime('09:00')
      setEndTime('10:00')
      setLoc('')
      // 날짜는 그리드에서 이미 골라 들어옴 — 달력은 기본 접힘, 수정할 때만 칩을 눌러 팝업(사용자 확정)
      setCalYm((initialDate || todaySeoul()).slice(0, 7))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, event])

  // 달력 위 '(새 일정)' 막대 미리보기 — add 모드에서 날짜·제목이 바뀔 때마다 부모에 알림.
  // 재열림 직후 1회는 스킵(위 리셋 effect가 신선한 초안을 이미 보냄 — stale 1프레임 방지, 적대 리뷰 확정)
  useEffect(() => {
    if (!onDraftChange) return
    if (draftSkip.current) {
      draftSkip.current = false
      return
    }
    if (!open || mode !== 'add' || !date) {
      onDraftChange(null)
      return
    }
    onDraftChange({ start: date, end: endDate || date, title: title.trim() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, date, endDate, title])

  // 날짜가 바뀌어 현재 반복 옵션이 성립하지 않으면(예: '매월 마지막 X요일'인데 마지막 요일이 아닌 날로 이동) 해제
  useEffect(() => {
    if (repeat !== 'none' && !repeatOptions(date).some((o) => o.value === repeat)) setRepeat('none')
  }, [date, repeat])

  // 미니달력 클릭-클릭: 한 번=시작(종료 대기) → 한 번 더=종료(같은 날=하루, 앞 날짜면 구간 뒤집기).
  // 선택이 완성되면 팝업을 닫는다(숙소예약 UX).
  const pickDay = (key: string) => {
    if (repeat !== 'none') {
      // 반복 일정은 단일 날짜 기준 — 항상 하루 선택
      setDate(key)
      setEndDate('')
      setPicking(false)
      setCalAnchor(null)
      return
    }
    if (!picking) {
      setDate(key)
      setEndDate('')
      setPicking(true)
    } else {
      if (key < date) {
        setEndDate(date === key ? '' : date)
        setDate(key)
      } else {
        setEndDate(key === date ? '' : key)
      }
      setPicking(false)
      setCalAnchor(null)
    }
  }

  const buildInput = () => {
    const s = date
    const e = repeat !== 'none' ? date : (endDate || date) // 반복 일정은 단일 날짜 기준
    // [구분] + 내용 + '@참석자'(있을 때만) — 표시/파싱 규칙과 동일 포맷.
    // 수정에서 종류를 안 바꿨으면 원본 태그 문구 보존(예: '[출장] 국내(…)' 형식 유지), 바꿨으면 표준 태그.
    const tagText = cat ? (cat === origCat && origTag ? origTag : STD_TAG[cat]) : null
    const fullTitle = (tagText ? `[${tagText}] ` : '') + title.trim() + (attendees.length ? ` @${attendees.join(', ')}` : '')
    return {
      title: fullTitle,
      loc: loc.trim(),
      allDay,
      start: allDay ? s : `${s}T${startTime}`,
      end: allDay ? e : `${e}T${endTime}`,
      repeat,
      repeatUntil: '', // 종료일 입력 없음 — API 기본(6개월·매년 5년) 적용
      createdBy: user || '',
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    // 열려 있던 피커/드롭다운은 접는다 — 반복 범위 확인창 위에 피커가 떠 있는 z순서 꼬임 방지(리뷰 부수 관찰)
    setCalAnchor(null)
    setTimeAnchor(null)
    setRepeatAnchor(null)
    setPicking(false)
    if (!isAdmin || !user) return setError('관리자 로그인이 필요합니다')
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!date) return setError('날짜를 선택해주세요')
    if (!allDay && repeat === 'none' && (endDate || date) === date && endTime <= startTime)
      return setError('종료 시간이 시작보다 빨라요')
    if (endDate && endDate < date) return setError('종료일이 시작일보다 빨라요')
    setError(null)
    // 반복 시리즈 수정은 범위(이 일정만/이후/전체) 선택을 먼저 물음
    if (mode === 'edit' && isSeries) { setScopeAsk('save'); return }
    void doSave('one')
  }

  const doSave = async (scope: CalScope) => {
    setScopeAsk(null)
    setBusy(true)
    try {
      const input = buildInput()
      const res = mode === 'add'
        ? await addCalEvent(input)
        : await updateCalEvent({ ...input, id: event!.id, scope, seriesId: event!.seriesId, occDate: dateOnly(event!.start) })
      setBusy(false)
      onSaved(res.note || (mode === 'add' ? '일정을 추가했어요' : '일정을 수정했어요'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패')
      setBusy(false)
    }
  }

  const remove = () => {
    if (busy || !event) return
    if (!isAdmin || !user) return setError('관리자 로그인이 필요합니다')
    if (isSeries) { setScopeAsk('delete'); return }
    setDelAsk(true) // 표준 ConfirmDialog로 확인(window.confirm 대체)
  }

  const doDelete = async (scope: CalScope) => {
    setScopeAsk(null)
    setError(null)
    setBusy(true)
    try {
      const res = await deleteCalEvent({ id: event!.id, scope, seriesId: event!.seriesId, occDate: dateOnly(event!.start) })
      setBusy(false)
      setDelAsk(false) // 확인창은 결과가 난 뒤에 닫음(진행 중엔 busy로 잠금)
      onSaved(res.note || '일정을 삭제했어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
      setBusy(false)
      setDelAsk(false) // 실패 시 확인창 닫고 본 모달의 오류 문구로 안내
    }
  }

  // 참석자 후보 — 팀원(센터 제외) + 이미 제목에 있던 이름(팀원 목록 밖 이름 보존)
  const attendeeNames = [...new Set([...MEMBERS.filter((m) => m.id !== '센터').map((m) => m.name), ...attendees])]

  const endEff = endDate || date
  const rangeLabel = !date
    ? '날짜 선택'
    : picking
      ? `${fmtK(date)} – ?`
      : date === endEff
        ? fmtK(date)
        : `${fmtK(date)} – ${fmtK(endEff, date)}`

  return (
    <>
    <Dialog
      open={open}
      onClose={() => { if (!busy) onClose() }} // 모달 밖 배경 클릭 = 모달까지 닫힘(사용자 확정 — 피커/드롭다운도 함께 닫힘)
      slotProps={{
        paper: {
          sx: {
            width: 420, maxWidth: '100%', m: 2,
            bgcolor: 'background.paper', backgroundImage: 'none',
            border: 1, borderColor: 'divider', borderRadius: `${radius.modal}px`, p: '18px 24px 20px',
          },
        },
      }}
    >
      <Box
        component="form"
        onSubmit={submit}
        onKeyDown={(e) => {
          // Escape는 피커/드롭다운만 닫는다(모달까지 닫히지 않게) — Popper는 Popover와 달리 키를 스스로 안 받음
          if (e.key === 'Escape' && (calAnchor || timeAnchor || repeatAnchor)) {
            e.stopPropagation()
            setCalAnchor(null)
            setTimeAnchor(null)
            setRepeatAnchor(null)
            setPicking(false)
          }
        }}
        sx={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* 헤더 — 모드 캡션(작게) + 닫기 */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '.06em' }}>
            {mode === 'add' ? '일정 추가' : '일정 수정'}
          </Typography>
          <IconButton onClick={onClose} disabled={busy} aria-label="닫기" size="small" sx={{ ml: 'auto', color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: iconSize.action }} />
          </IconButton>
        </Box>

        {/* 제목 — 주인공(크게·첫 포커스·밑줄 포커스) */}
        <InputBase
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="일정 제목"
          autoFocus
          fullWidth
          inputProps={{ 'aria-label': '제목' }}
          sx={{
            fontSize: 19, fontWeight: 700, pb: '6px',
            borderBottom: '2px solid', borderColor: 'divider', borderRadius: 0,
            transition: 'border-color .15s',
            '&.Mui-focused': { borderColor: 'primary.main' },
            '& input::placeholder': { color: 'text.disabled', opacity: 1 },
          }}
        />

        {/* 종류 — 아이콘 원. 선택하면 가로로 늘어나며 이름이 안으로(사용자 확정 모션). 재클릭=해제 */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '7px', mt: 1.25, mb: 0.5 }}>
          {PICK_CATS.map((c) => {
            const on = cat === c
            const color = CAT_META[c].color
            const Icon = CAT_ICON[c]
            return (
              <Box
                key={c}
                component="button"
                type="button"
                onClick={() => setCat(on ? null : c)}
                aria-pressed={on}
                aria-label={`종류 ${CAT_META[c].label}`}
                title={CAT_META[c].label}
                sx={{
                  height: 30, minWidth: 30, px: '7px', borderRadius: `${radius.pill}px`, border: 'none',
                  display: 'inline-flex', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit',
                  bgcolor: alpha(color, on ? 0.22 : 0.13),
                  opacity: on ? 1 : 0.5,
                  boxShadow: on ? `inset 0 0 0 1px ${alpha(color, 0.55)}` : 'none',
                  transition: 'opacity .15s, background-color .2s, box-shadow .2s',
                  '&:hover': { opacity: on ? 1 : 0.85 },
                  '& svg': { fontSize: 16, color, flex: 'none', ...(c === 'trip_intl' ? { transform: 'rotate(45deg)' } : null) },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <Icon />
                <Box component="span" sx={{
                  maxWidth: on ? 96 : 0, opacity: on ? 1 : 0, ml: on ? '6px' : 0,
                  overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: 'text.primary',
                  transition: 'max-width .24s ease, opacity .18s ease, margin-left .24s ease',
                }}>
                  {CAT_META[c].label}
                </Box>
              </Box>
            )
          })}
        </Box>

        {/* 아이콘 행 스택 — 언제 / 반복 / 누구 / 어디 */}
        <Box>
          <FieldRow icon={<AccessTimeIcon />} wrap>
            <SummaryChip
              label={rangeLabel}
              active={!!calAnchor}
              ariaLabel="기간 선택"
              onClick={(e) => { const el = e.currentTarget; setCalAnchor((a) => (a ? null : el)); setTimeAnchor(null); setRepeatAnchor(null); setPicking(false) }}
            />
            {!allDay && (
              <SummaryChip
                label={`${startTime} – ${endTime}`}
                active={!!timeAnchor}
                ariaLabel="시간 선택"
                onClick={(e) => { const el = e.currentTarget; setTimeAnchor((a) => (a ? null : el)); setCalAnchor(null); setRepeatAnchor(null) }}
              />
            )}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, flex: 'none' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>종일</Typography>
              <Switch size="small" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); setTimeAnchor(null) }} slotProps={{ input: { 'aria-label': '종일' } }} />
            </Box>
          </FieldRow>

          {/* 기간 미니달력(클릭-클릭) — 칩에 붙는 미니팝업(모달 크기 불변).
              Popover(차단형) → Popper(비차단형): 팝업이 열린 채로도 밖의 버튼이 첫 클릭에 눌린다(사용자 요청).
              onMouseDown 방지 = 팝업이 포커스를 뺏지 않아 Dialog 포커스 트랩과 충돌 없음 */}
          <Popper open={!!calAnchor} anchorEl={calAnchor} placement="bottom-start" transition sx={{ zIndex: (th) => th.zIndex.modal + 1 }}>
            {({ TransitionProps }) => (
              <Grow {...TransitionProps} style={{ transformOrigin: 'top left' }}>
                <Box onMouseDown={(e) => e.preventDefault()} sx={{ mt: 0.5, borderRadius: `${radius.card}px`, boxShadow: '0 10px 32px rgba(0,0,0,.5)' }}>
                  {/* mousedown 기준 감지 — 팝업을 연 클릭 자체가 새 팝업을 도로 닫는 레이스 차단(칩 전환 원클릭).
                      앵커 칩 위는 제외: 닫기/열기 토글은 칩 onClick이 담당(mousedown 닫힘+click 재열림 이중동작 방지) */}
                  <ClickAwayListener mouseEvent="onMouseDown" touchEvent="onTouchStart" onClickAway={(e) => { if (calAnchor && e.target instanceof Node && calAnchor.contains(e.target)) return; setCalAnchor(null); setPicking(false) }}>
                    <Box>
                      <MiniCalendar ym={calYm || (date || todaySeoul()).slice(0, 7)} onYm={setCalYm} start={date} end={endDate} picking={picking} onPick={pickDay} />
                    </Box>
                  </ClickAwayListener>
                </Box>
              </Grow>
            )}
          </Popper>
          {/* 시간 피커 — 24시간제 스크롤 목록(시작·종료 2열, 휠 스크롤) */}
          <Popper open={!!timeAnchor && !allDay} anchorEl={timeAnchor} placement="bottom-start" transition sx={{ zIndex: (th) => th.zIndex.modal + 1 }}>
            {({ TransitionProps }) => (
              <Grow {...TransitionProps} style={{ transformOrigin: 'top left' }}>
                <Box
                  onMouseDown={(e) => {
                    // 캡션·여백 클릭이 포커스를 body로 흘리면 Dialog 포커스트랩이 개입해 Escape가 모달을 닫아버림(리뷰 확정) — 표면 전체에서 포커스 이탈 방지.
                    // 스크롤 리스트 자체(스크롤바 드래그)만 예외로 두되, 포커스는 칩으로 되돌린다.
                    const t = e.target as HTMLElement
                    if (t.hasAttribute('data-timelist')) { requestAnimationFrame(() => timeAnchor?.focus()); return }
                    e.preventDefault()
                  }}
                  sx={{ mt: 0.5, borderRadius: `${radius.card}px`, boxShadow: '0 10px 32px rgba(0,0,0,.5)' }}
                >
                  <ClickAwayListener mouseEvent="onMouseDown" touchEvent="onTouchStart" onClickAway={(e) => { if (timeAnchor && e.target instanceof Node && timeAnchor.contains(e.target)) return; setTimeAnchor(null) }}>
                    <Box sx={{ display: 'flex', gap: 0.75, p: 1, bgcolor: 'background.elevated', border: 1, borderColor: 'divider', borderRadius: `${radius.card}px` }}>
                      <TimeColumn label="시작" value={startTime} onPick={setStartTime} />
                      <TimeColumn label="종료" value={endTime} onPick={setEndTime} />
                    </Box>
                  </ClickAwayListener>
                </Box>
              </Grow>
            )}
          </Popper>

          {mode === 'add' && (
            <FieldRow icon={<RepeatIcon />} wrap>
              {/* 반복은 옵션 선택만으로 끝(사용자 확정) — 종료일 입력 없음, 기간은 기본 6개월(매년 5년) */}
              <SummaryChip
                label={repeatOptions(date).find((o) => o.value === repeat)?.label ?? '반복 안 함'}
                active={!!repeatAnchor}
                ariaLabel="반복"
                onClick={(e) => { const el = e.currentTarget; setRepeatAnchor((a) => (a ? null : el)); setCalAnchor(null); setTimeAnchor(null); setPicking(false) }}
              />
            </FieldRow>
          )}
          {/* 반복 드롭다운 — 기간/시간 피커와 동일한 비차단 미니팝업(모달 안 클릭=드롭다운만 닫힘·원클릭) */}
          <Popper open={!!repeatAnchor} anchorEl={repeatAnchor} placement="bottom-start" transition sx={{ zIndex: (th) => th.zIndex.modal + 1 }}>
            {({ TransitionProps }) => (
              <Grow {...TransitionProps} style={{ transformOrigin: 'top left' }}>
                <Box onMouseDown={(e) => e.preventDefault()} sx={{ mt: 0.5, borderRadius: `${radius.card}px`, boxShadow: '0 10px 32px rgba(0,0,0,.5)' }}>
                  <ClickAwayListener mouseEvent="onMouseDown" touchEvent="onTouchStart" onClickAway={(e) => { if (repeatAnchor && e.target instanceof Node && repeatAnchor.contains(e.target)) return; setRepeatAnchor(null) }}>
                    <Box sx={{ p: 0.5, bgcolor: 'background.elevated', border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, minWidth: 176 }}>
                      {repeatOptions(date).map((o) => {
                        const on = o.value === repeat
                        return (
                          <Box
                            key={o.value}
                            component="button"
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              setRepeat(o.value)
                              if (o.value !== 'none') { setEndDate(''); setPicking(false); setCalAnchor(null) } // 반복은 단일 날짜 기준 — 날짜칩도 숨김
                              setRepeatAnchor(null)
                            }}
                            sx={{
                              display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                              px: 1.25, py: '7px', fontSize: 13, whiteSpace: 'nowrap', borderRadius: `${radius.input}px`,
                              ...(on
                                ? { bgcolor: 'primary.main', color: 'common.white', fontWeight: 700 }
                                : { bgcolor: 'transparent', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }),
                            }}
                          >
                            {o.label}
                          </Box>
                        )
                      })}
                    </Box>
                  </ClickAwayListener>
                </Box>
              </Grow>
            )}
          </Popper>
          {mode === 'edit' && isSeries && (
            <FieldRow icon={<RepeatIcon />}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                반복 일정 — 저장·삭제 시 범위(이 일정만/이후/전체)를 선택해요. 날짜 변경은 '이 일정만'에서만 반영.
              </Typography>
            </FieldRow>
          )}

          <FieldRow icon={<GroupsIcon />} wrap>
            {attendeeNames.map((name) => {
              const on = attendees.includes(name)
              const c = memberColor(name)
              return (
                <Box
                  key={name}
                  component="button"
                  type="button"
                  onClick={() => setAttendees((a) => (on ? a.filter((n) => n !== name) : [...a, name]))}
                  aria-pressed={on}
                  aria-label={`참석자 ${name}`}
                  title={name}
                  sx={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, lineHeight: 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s, box-shadow .15s, color .15s',
                    ...(on
                      ? { bgcolor: c, color: 'common.white', boxShadow: `0 0 0 2px ${alpha(c, 0.35)}` }
                      : { bgcolor: alpha(c, 0.15), color: 'text.secondary', '&:hover': { bgcolor: alpha(c, 0.3), color: 'text.primary' } }),
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                  }}
                >
                  {given(name)}
                </Box>
              )
            })}
          </FieldRow>

          <FieldRow icon={<PlaceOutlinedIcon />}>
            <InputBase
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="장소 추가"
              fullWidth
              inputProps={{ 'aria-label': '장소' }}
              sx={{ fontSize: 13.5, '& input::placeholder': { color: 'text.disabled', opacity: 1 } }}
            />
          </FieldRow>
        </Box>

        {/* role=alert — 검증·저장 실패를 스크린리더에도 즉시 안내 */}
        {error && <Typography role="alert" color="error" variant="body2" sx={{ mt: 1 }}>{error}</Typography>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
          {mode === 'edit' && (
            <Button color="error" onClick={remove} disabled={busy} sx={{ mr: 'auto' }}>삭제</Button>
          )}
          <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? '저장 중…' : '저장'}</Button>
        </Box>
      </Box>
    </Dialog>

    {/* 단일 일정 삭제 확인 — 표준 ConfirmDialog(destructive) */}
    <ConfirmDialog
      open={delAsk}
      destructive
      title="일정을 삭제할까요?"
      description="삭제 후 되돌릴 수 없습니다."
      confirmLabel="삭제"
      busy={busy}
      onConfirm={() => void doDelete('one')}
      onClose={() => setDelAsk(false)}
    />

    {/* 반복 시리즈 범위 선택 — 저장·삭제 시 이 일정만 / 이후 / 전체 */}
    <Dialog open={!!scopeAsk} onClose={() => !busy && setScopeAsk(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 340 } } } }}>
      <DialogTitle>{scopeAsk === 'delete' ? '반복 일정 삭제' : '반복 일정 수정'}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>어느 범위에 적용할까요?</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 0.75, flexDirection: 'column', alignItems: 'stretch' }}>
        <Button fullWidth variant="outlined" disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('one') : doSave('one'))}>이 일정만</Button>
        <Button fullWidth variant="outlined" disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('following') : doSave('following'))}>이 일정 및 이후</Button>
        <Button fullWidth variant="outlined" color={scopeAsk === 'delete' ? 'error' : 'primary'} disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('all') : doSave('all'))}>모든 일정</Button>
        <Button fullWidth disabled={busy} onClick={() => setScopeAsk(null)} sx={{ color: 'text.secondary', mt: 0.5 }}>취소</Button>
      </DialogActions>
    </Dialog>
    </>
  )
}
