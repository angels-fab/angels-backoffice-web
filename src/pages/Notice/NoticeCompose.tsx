import { useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import InputBase from '@mui/material/InputBase'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import PushPinIcon from '@mui/icons-material/PushPin'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { inlineFieldSx } from '@/components/ds/fields'
import type { Notice, NoticeFile } from '@/types'
import { todaySeoul } from '@/utils/date'
import { ComboField } from '@/pages/Work/inlineFields'
import { MEMBERS, given } from '@/pages/Calendar/members'
import { uploadNoticeFile, removeNoticeFiles } from '@/api/notices'
import { iconSize, radius, solid, typescale, weight } from '@/theme/tokens'
import { AttachmentIcon, formatBytes } from './attachmentUI'
import { fileTypeRank } from './fileTypeIcons'
import NoticeBodyEditor from './NoticeBodyEditor'

// 분류 항목(드롭다운) — 안전/보안/시설/교육/일반
export const NOTICE_CATS = ['안전', '보안', '시설', '교육', '일반']
// 해당자 후보 — 캘린더 팀원(센터 제외): 신현진/박주봉/박세리/조성범
const TARGET_MEMBERS = MEMBERS.filter((m) => m.id !== '센터')
// 직원(센터장 신현진 제외) — '센터(직원)' 프리셋 대상
const STAFF_MEMBERS = TARGET_MEMBERS.filter((m) => m.id !== '신현진')

// 선택된 해당자(풀네임 배열) → 표시·저장 라벨
//  - 모두 → 센터(전체) / 신현진 제외 직원 3명 → 센터(직원) / 일부 → 이름(현진,세리) 나열 / 없음 → '' (미표기)
function targetLabel(names: string[]): string {
  const set = new Set(names)
  if (set.size === 0) return ''
  if (TARGET_MEMBERS.every((m) => set.has(m.name))) return '센터(전체)'
  if (set.size === STAFF_MEMBERS.length && STAFF_MEMBERS.every((m) => set.has(m.name))) return '센터(직원)'
  return TARGET_MEMBERS.filter((m) => set.has(m.name)).map((m) => given(m.name)).join(', ')
}

// 저장된 라벨/레거시 값 → 선택(풀네임 배열) — 편집 시 칩 상태 복원
function parseTargets(raw: string): string[] {
  const s = (raw || '').trim()
  if (!s) return []
  if (s === '전체' || s === '센터(전체)') return TARGET_MEMBERS.map((m) => m.name)
  if (s === '센터(직원)') return STAFF_MEMBERS.map((m) => m.name)
  const tokens = s.split(',').map((t) => t.trim()).filter(Boolean)
  return TARGET_MEMBERS.filter((m) => tokens.includes(m.name) || tokens.includes(given(m.name))).map((m) => m.name)
}

// 해당자 프리셋 버튼 스타일(센터(전체)/센터(직원)) — 활성=파랑 채움
const presetSx = (active: boolean) => (th: Theme) => ({
  fontSize: typescale.small.size, fontWeight: weight.semibold, px: 1.1, py: '3px', borderRadius: `${radius.pill}px`,
  cursor: 'pointer', border: '1px solid', flex: 'none', whiteSpace: 'nowrap', transition: 'background-color .15s',
  ...(active
    ? { bgcolor: solid.blue, borderColor: solid.blue, color: 'common.white' }
    : { borderColor: th.palette.divider, color: 'text.secondary' }),
})

export interface NoticeFormValues {
  cat: string
  title: string
  body: string
  ref: string
  dept: string
  deptMgr: string
  target: string
  pinned: boolean
  attachments: NoticeFile[]
}

/** 작성 중 첨부 1건의 로컬 상태 — 완료(done)만 저장 대상, 업로드중/실패는 UI 표시용 */
type Upload = {
  key: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'done' | 'error'
  path?: string
  error?: string
}

const inputSx = (th: Theme) => ({ ...inlineFieldSx(th), py: 0.4 })

export function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = !!value.trim()
  return (
    <>
      <Tooltip title={active ? '관련자료(첨부) 편집' : '관련자료(첨부) 추가'}>
        <IconButton size="small" aria-label="관련자료" onClick={(e) => setAnchor(e.currentTarget)} sx={(th) => ({ color: active ? th.palette.accent.blue : 'text.disabled', p: 0.5 })}>
          <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: `${radius.button}px`, mt: 0.5 } } }}>
        <Box sx={{ p: 1.5, width: 300 }}>
          <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary', mb: 0.5 }}>관련자료 / 첨부 링크</Box>
          <InputBase autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" inputProps={{ 'aria-label': '관련자료 링크' }} sx={(th) => ({ ...inputSx(th), width: '100%', py: 0.5 })} />
        </Box>
      </Popover>
    </>
  )
}

export function CatDrop({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select
      value={NOTICE_CATS.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      variant="standard"
      disableUnderline
      renderValue={(v) => (v ? <span>{v}</span> : <Box component="span" sx={{ color: 'text.disabled' }}>분류</Box>)}
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      sx={(th) => ({
        // 이 폭이 표 **전체 분류 열**을 밀어올린다 — 모바일에선 68 로(개선요청 81)
        ...inputSx(th), width: { xs: 68, shell: 88 }, maxWidth: '100%', height: 32,
        '& .MuiSelect-select': { p: 0, pl: '8px !important', pr: '22px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {NOTICE_CATS.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: typescale.body.size }}>{c}</MenuItem>)}
    </Select>
  )
}

export interface NoticeComposeProps {
  mode: 'new' | 'edit'
  notice?: Notice
  author: string
  saving: boolean
  deptOptions: string[]
  deptMgrOptions: string[]
  onSave: (v: NoticeFormValues) => void
  onCancel: () => void
}

/**
 * 폼의 상태·업로드·저장 규칙 전부 — **PC 표 폼과 모바일 전체화면 시트가 이 훅 하나를 같이 쓴다**
 * (요청메모 91 A안). 로직을 복제하면 첨부 고아 정리 같은 규칙이 곧 어긋난다.
 */
export function useNoticeComposeForm({ mode, notice, onSave, onCancel }: {
  mode: 'new' | 'edit'
  notice?: Notice
  onSave: (v: NoticeFormValues) => void
  onCancel: () => void
}) {
  const [cat, setCat] = useState(notice && NOTICE_CATS.includes(notice.cat) ? notice.cat : '일반')
  const [title, setTitle] = useState(notice?.title || '')
  const [body, setBody] = useState(notice?.body || '')
  const [refLink, setRefLink] = useState(notice?.ref || '')
  const [dept, setDept] = useState(notice?.dept || '')
  const [deptMgr, setDeptMgr] = useState(notice?.deptMgr || '')
  const [pinned, setPinned] = useState(notice?.pinned || false)
  // 신규: 기본 센터(전체) / 편집: 저장값 복원
  const [targets, setTargets] = useState<string[]>(
    mode === 'new' ? TARGET_MEMBERS.map((m) => m.name) : parseTargets(notice?.target || ''),
  )
  // 첨부파일 — 파일별 업로드 상태 추적(업로드중/완료/실패). 완료 항목만 저장.
  // sessionPaths = 이번 작성세션에 새로 업로드한 경로(취소·저장 시 스토리지 정리)
  const [uploads, setUploads] = useState<Upload[]>(
    (notice?.attachments || []).map((a) => ({ key: a.path, name: a.name, size: a.size, type: a.type, status: 'done' as const, path: a.path })),
  )
  const uploading = uploads.some((u) => u.status === 'uploading')
  // 유형별 정렬(pdf→hwp→docx→xlsx→pptx→txt→image→zip→기타) — 표시용. 같은 유형은 기존 순서 유지
  const sortedUploads = useMemo(
    () => [...uploads].sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name)),
    [uploads],
  )
  const sessionPaths = useRef<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dateStr = mode === 'new' ? todaySeoul() : (notice?.date || '')
  const toggleTarget = (name: string) => setTargets((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))
  const setAllTargets = () => setTargets(TARGET_MEMBERS.map((m) => m.name))
  const setStaffTargets = () => setTargets(STAFF_MEMBERS.map((m) => m.name))
  const isAllTargets = TARGET_MEMBERS.every((m) => targets.includes(m.name))
  const isStaffTargets = targets.length === STAFF_MEMBERS.length && STAFF_MEMBERS.every((m) => targets.includes(m.name))

  // 파일 선택 → 파일별 자리 표시 후 순차 업로드(성공=done+경로, 실패=error). 한 건 실패해도 나머지 진행.
  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const picked = Array.from(list).map((file) => ({ file, key: crypto.randomUUID() }))
    setUploads((prev) => [
      ...prev,
      ...picked.map(({ file, key }) => ({ key, name: file.name, size: file.size, type: file.type || '', status: 'uploading' as const })),
    ])
    for (const { file, key } of picked) {
      try {
        const meta = await uploadNoticeFile(file)
        sessionPaths.current.add(meta.path)
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'done', path: meta.path } : u)))
      } catch (e) {
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'error', error: e instanceof Error ? e.message : '업로드 실패' } : u)))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  // 목록에서 제거(스토리지 정리는 저장/취소 시) — 화면에서 즉시 제외
  const removeUpload = (key: string) => setUploads((prev) => prev.filter((u) => u.key !== key))

  // 완료 파일만 저장(빈 선택 = 빈값 = 해당자 미표기) + 이번 세션에 올렸다 뺀 파일은 orphan 정리
  const save = () => {
    const attachments: NoticeFile[] = uploads
      .filter((u) => u.status === 'done' && u.path)
      .map((u) => ({ name: u.name, path: u.path as string, size: u.size, type: u.type }))
      .sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name))
    const finalPaths = new Set(attachments.map((a) => a.path))
    const orphans = Array.from(sessionPaths.current).filter((p) => !finalPaths.has(p))
    if (orphans.length) void removeNoticeFiles(orphans).catch(() => {})
    orphans.forEach((p) => sessionPaths.current.delete(p))
    onSave({ cat, title: title.trim(), body: body.trim(), ref: refLink.trim(), dept: dept.trim(), deptMgr: deptMgr.trim(), target: targetLabel(targets), pinned, attachments })
  }
  // 취소 — 저장 안 하므로 이번 세션에 새로 올린 파일 전부 정리(기존 첨부는 보존)
  const cancel = () => {
    const news = Array.from(sessionPaths.current)
    if (news.length) void removeNoticeFiles(news).catch(() => {})
    onCancel()
  }

  return {
    cat, setCat, title, setTitle, body, setBody, refLink, setRefLink,
    dept, setDept, deptMgr, setDeptMgr, pinned, setPinned,
    targets, toggleTarget, setAllTargets, setStaffTargets, isAllTargets, isStaffTargets,
    uploads, sortedUploads, uploading, fileInputRef, onPickFiles, removeUpload,
    save, cancel, dateStr,
  }
}

/** 해당자 선택(프리셋 + 팀원 동그라미 칩) — PC 폼·모바일 시트 공용 */
export function TargetPicker({ f }: { f: ReturnType<typeof useNoticeComposeForm> }) {
  return (
    <>
      <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, letterSpacing: '0.04em', color: 'text.disabled', ml: 0.5 }}>해당자</Box>
      {/* 프리셋 — 센터(전체)=4명 자동선택 / 센터(직원)=신현진 제외 3명 */}
      <Box role="button" tabIndex={0} aria-label="센터(전체) 선택" onClick={f.setAllTargets} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.setAllTargets() } }} sx={presetSx(f.isAllTargets)}>센터(전체)</Box>
      <Box role="button" tabIndex={0} aria-label="센터(직원) 선택" onClick={f.setStaffTargets} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.setStaffTargets() } }} sx={presetSx(f.isStaffTargets)}>센터(직원)</Box>
      {/* 팀원 동그라미 칩 — 선택=컬러, 해제=흑백(동그라미는 잘 보임) */}
      {TARGET_MEMBERS.map((m) => {
        const on = f.targets.includes(m.name)
        return (
          <Box
            key={m.id}
            role="checkbox" aria-checked={on} aria-label={`해당자 ${m.name}${on ? '' : ' (해제됨)'}`} tabIndex={0}
            title={m.name}
            onClick={() => f.toggleTarget(m.name)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.toggleTarget(m.name) } }}
            // 배경만 동적(사람색)이라 style 에 남기고, 글자색은 토큰으로 — 솔리드 사람색 칩 위
            // 흰 글자는 이 저장소 공통 패턴(ChipContent NamePill·WeekBoard·eventCard와 같은 자리)
            style={{ backgroundColor: m.color, filter: on ? 'none' : 'grayscale(1)', opacity: on ? 1 : 0.6 }}
            sx={{
              width: 32, height: 32, borderRadius: radius.circle, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'common.white',
              fontSize: typescale.body.size, fontWeight: weight.bold, letterSpacing: '-0.5px', cursor: 'pointer', flex: 'none',
              transition: 'opacity .15s, filter .15s',
            }}
          >
            {given(m.name)}
          </Box>
        )
      })}
    </>
  )
}

/** 첨부 영역(파일 첨부 버튼 + 상태 칩 그리드 + 업로드중 안내) — PC 폼·모바일 시트 공용 */
export function AttachmentArea({ f }: { f: ReturnType<typeof useNoticeComposeForm> }) {
  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex' }}>
          <input ref={f.fileInputRef} type="file" multiple hidden onChange={(e) => void f.onPickFiles(e.target.files)} />
          <Box
            role="button" tabIndex={0} aria-label="파일 첨부"
            onClick={() => f.fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.fileInputRef.current?.click() } }}
            sx={(th) => ({
              display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 1, py: '5px', borderRadius: `${radius.pill}px`,
              border: '1px dashed', borderColor: th.palette.divider, color: 'text.secondary', cursor: 'pointer',
              fontSize: typescale.small.size, fontWeight: weight.semibold, flex: 'none', transition: 'color .15s, border-color .15s',
              '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main },
            })}
          >
            <AttachFileIcon sx={{ fontSize: iconSize.body }} />파일 첨부
          </Box>
        </Box>
        {f.uploads.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 0.75 }}>
            {f.sortedUploads.map((u) => {
              const err = u.status === 'error'
              return (
                <Tooltip key={u.key} title={err ? (u.error || '업로드 실패') : u.name} disableHoverListener={false}>
                  <Box
                    sx={(th) => ({
                      display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', minWidth: 0, pl: 0.85, pr: 0.25, py: '3px',
                      borderRadius: `${radius.chip}px`, bgcolor: err ? alpha(th.palette.error.main, 0.08) : alpha(th.palette.text.primary, 0.05),
                      border: `1px solid ${err ? alpha(th.palette.error.main, 0.5) : th.palette.divider}`,
                      opacity: u.status === 'uploading' ? 0.7 : 1,
                    })}
                  >
                    {u.status === 'uploading'
                      ? <CircularProgress size={13} thickness={5} sx={{ flex: 'none' }} />
                      : err
                        ? <ErrorOutlineIcon sx={{ fontSize: iconSize.body, color: 'error.main', flex: 'none' }} />
                        : <AttachmentIcon type={u.type} name={u.name} size={17} />}
                    <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: typescale.small.size, color: err ? 'error.main' : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</Box>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none' }}>
                      {u.status === 'uploading' ? '업로드 중' : err ? '실패' : formatBytes(u.size)}
                    </Box>
                    {u.status !== 'uploading' && (
                      <Tooltip title="첨부 제거">
                        <IconButton size="small" aria-label={`${u.name} 제거`} onClick={() => f.removeUpload(u.key)} sx={{ p: 0.25, flex: 'none', color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                          <CloseIcon sx={{ fontSize: iconSize.caption }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        )}
      </Box>
      {f.uploading && <Box sx={{ fontSize: typescale.caption.size, color: 'text.disabled', mt: -0.25 }}>파일 업로드 중… 완료 후 저장하세요.</Box>}
    </>
  )
}

/** 공지 작성/수정 인라인 행 — 표 열(번호·분류·제목·작성자·작성일)에 맞춘 2행 구조. */
export default function NoticeCompose({ mode, notice, author, saving, deptOptions, deptMgrOptions, onSave, onCancel }: NoticeComposeProps) {
  const f = useNoticeComposeForm({ mode, notice, onSave, onCancel })
  const { cat, setCat, title, setTitle, body, setBody, refLink, setRefLink, dept, setDept, deptMgr, setDeptMgr, pinned, setPinned, uploading, save, cancel, dateStr } = f
  const amber = (th: Theme) => alpha(th.palette.accent.amber, 0.07)
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <>
      <TableRow sx={{ '& td': { bgcolor: amber, py: 1, verticalAlign: 'middle' } }}>
        {/* 번호 칸 → 중요(상단강조) 압정 토글 */}
        <TableCell sx={{ textAlign: 'center' }} onClick={stop}>
          <Tooltip title={pinned ? '중요(상단강조) 해제' : '중요(상단강조)'}>
            <Box
              role="checkbox" aria-checked={pinned} aria-label="중요(상단강조)" tabIndex={0}
              onClick={() => setPinned((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((v) => !v) } }}
              sx={(th) => ({
                width: 26, height: 26, mx: 'auto', borderRadius: `${radius.chip}px`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid',
                ...(pinned
                  ? { bgcolor: th.palette.accent.amber, borderColor: th.palette.accent.amber, color: 'common.white' }
                  : { borderColor: th.palette.divider, color: 'text.disabled' }),
              })}
            >
              <PushPinIcon sx={{ fontSize: iconSize.body }} />
            </Box>
          </Tooltip>
        </TableCell>
        <TableCell onClick={stop}><CatDrop value={cat} onChange={setCat} /></TableCell>
        <TableCell onClick={stop}>
          <InputBase
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            inputProps={{ 'aria-label': '제목' }}
            endAdornment={<LinkField value={refLink} onChange={setRefLink} />}
            sx={(th) => ({ ...inputSx(th), width: '100%', height: 32 })}
          />
        </TableCell>
        {/* 작성자·작성일은 모바일에서 **목록 행·헤더가 이미 숨기는 열**이다(index.tsx). 폼만 안 숨겨서
            폼을 여는 순간 그 두 열이 되살아나 표가 374 → 502px 로 부풀었다(개선요청 81 실측). */}
        <TableCell sx={{ display: { xs: 'none', shell: 'table-cell' }, textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size }}>{mode === 'new' ? author : (notice?.author || '-')}</TableCell>
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</TableCell>
        <TableCell />
        {/* 더보기 열 자리 — 이 폼은 팀원에게만 렌더되므로 목록 표의 더보기 열이 항상 있다(빠지면 폼 배경이 오른쪽 끝까지 안 닿음) */}
        <TableCell />
      </TableRow>
      <TableRow sx={{ '& td': { borderTop: 0, bgcolor: amber, py: 0.75, verticalAlign: 'top' } }}>
        <TableCell />
        <TableCell colSpan={3} onClick={stop}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {/* 부서(≈6음절) / 부서담당자(≈4음절) 자동완성 + 해당자(부서담당자 옆) */}
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ width: 104, maxWidth: '100%' }}>
                <ComboField value={dept} onChange={setDept} options={deptOptions} placeholder="부서" ariaLabel="부서" />
              </Box>
              <Box sx={{ width: 80, maxWidth: '100%' }}>
                <ComboField value={deptMgr} onChange={setDeptMgr} options={deptMgrOptions} placeholder="담당자" ariaLabel="부서담당자" />
              </Box>
              <TargetPicker f={f} />
            </Box>
            <Box sx={(th) => ({ ...inputSx(th), width: '100%', py: '8px', px: '10px' })}>
              <NoticeBodyEditor value={body} onChange={setBody} placeholder="내용 (굵게·목록 등 서식 지원)" />
            </Box>
            {/* 첨부파일 — 파일 선택 버튼(한 줄) + 파일별 상태 칩(그리드 정렬·말줄임·반응형). 업로드는 즉시(팀원+, RLS 검증) */}
            <AttachmentArea f={f} />
          </Box>
        </TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'center', verticalAlign: 'top', pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={saving ? '저장 중…' : uploading ? '업로드 중…' : mode === 'edit' ? '수정 저장' : '등록'}>
              <span><IconButton size="small" color="success" aria-label="저장" onClick={save} disabled={saving || uploading}>
                {saving ? <CircularProgress size={17} thickness={5} color="success" /> : <CheckIcon sx={{ fontSize: iconSize.action }} />}
              </IconButton></span>
            </Tooltip>
            <Tooltip title="취소">
              <span><IconButton size="small" color="error" aria-label="취소" onClick={cancel} disabled={saving || uploading}><CloseIcon sx={{ fontSize: iconSize.action }} /></IconButton></span>
            </Tooltip>
          </Box>
        </TableCell>
        <TableCell />
        {/* 더보기 열 자리 (위 행과 같은 이유) */}
        <TableCell />
      </TableRow>
    </>
  )
}
