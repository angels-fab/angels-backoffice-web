import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { iconSize, motion, radius, typescale } from '@/theme/tokens'
import { ComboField, DateField, TimeRangeField, LinkButton, AttachButton } from './inlineFields'
import RichContentEditor from './RichContentEditor'
import { uploadWorkFile, removeWorkFiles } from '@/api/works'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import { fileTypeRank } from '@/pages/Notice/fileTypeIcons'
import type { NoticeFile } from '@/types'

/** 인라인 새 업무 작성 폼 값 — 저장 시 index에서 createWork/updateWork 페이로드로 변환 */
export interface NewTaskForm {
  cat: string
  title: string
  /** 업무 본문 일반 텍스트(• 글머리 포함) — 시트 '업무내용' 저장·검색·대체표시용 */
  body: string
  /** 업무 본문 서식 JSON(버전 포함) — 시트 '업무내용서식' 저장용 */
  bodyFmt: string
  mgr: string
  start: string
  plan: string
  dept: string
  time: string
  loc: string
  link: string
  chief: boolean
  /** 첨부파일 — 업로드 완료된 항목만(Storage work-files 저장). 미변경 시 기존 값 유지 */
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

/** 드롭다운/자동완성 후보 */
export interface FieldOptions {
  cats: string[]
  mgrs: string[]
  depts: string[]
  locs: string[]
}

export interface NewTaskCardProps {
  /** 저장 진행 중 — 입력/버튼 비활성화 */
  saving: boolean
  /** 드롭다운/자동완성 후보 */
  options: FieldOptions
  /** 수정 모드 — 기존 값 채움(없으면 새 업무 빈 폼) */
  initial?: NewTaskForm
  onCancel: () => void
  onSave: (form: NewTaskForm) => void
  /** 입력값 존재 여부 변화 알림 — 뷰 전환 시 작성 중 내용 보호용 */
  onDirtyChange?: (dirty: boolean) => void
}

// 카드 안에서 쓰는 인라인 입력 — 미니멀 보더 + 포커스 시 초록 테두리 (제목/본문 전용)
function Field({
  value, onChange, onChangeEvent, placeholder, multiline, minRows, ariaLabel, sx, inputRef,
}: {
  value: string
  onChange?: (v: string) => void
  /** 원본 이벤트가 필요할 때(커서 제어 등) — 있으면 onChange 대신 사용 */
  onChangeEvent?: (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  placeholder?: string
  multiline?: boolean
  minRows?: number
  ariaLabel: string
  sx?: SxProps<Theme>
  inputRef?: React.Ref<HTMLTextAreaElement | HTMLInputElement>
}) {
  return (
    <InputBase
      value={value}
      onChange={onChangeEvent ?? ((e) => onChange?.(e.target.value))}
      inputRef={inputRef}
      placeholder={placeholder}
      multiline={multiline}
      minRows={minRows}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={[
        (th) => ({
          bgcolor: alpha(th.palette.text.primary, 0.05),
          border: '1px solid', borderColor: th.palette.divider, borderRadius: `${radius.chip}px`,
          px: 1, py: 0.4, fontSize: typescale.body.size, color: 'text.primary',
          transition: 'border-color .12s',
          '&:hover': { borderColor: alpha(th.palette.text.secondary, 0.55) },
          '&.Mui-focused': { borderColor: th.palette.accent.green },
          '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  )
}

/**
 * 인라인 업무 작성/수정 카드 — 업무 카드 템플릿 그대로(초록 톤), 표시될 자리에 빈칸을 두고 직접 입력.
 * 제목줄: 구분(드롭다운)·제목·링크/첨부 아이콘·담당자(드롭다운)·발의일자 + 저장(✓)/취소(✕).
 * 본문: 부서(자동완성)/예정일/시간(wheel)/장소(자동완성) · 내용(Enter→글머리) + 우측 Check 토글.
 */
export default function NewTaskCard({ saving, options, initial, onCancel, onSave, onDirtyChange }: NewTaskCardProps) {
  const [cat, setCat] = useState(initial?.cat ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [bodyFmt, setBodyFmt] = useState(initial?.bodyFmt ?? '')
  const [mgr, setMgr] = useState(initial?.mgr ?? '')
  const [start, setStart] = useState(initial?.start ?? '')
  const [plan, setPlan] = useState(initial?.plan ?? '')
  const [dept, setDept] = useState(initial?.dept ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [loc, setLoc] = useState(initial?.loc ?? '')
  const [link, setLink] = useState(initial?.link ?? '')
  const [chief, setChief] = useState(initial?.chief ?? false)
  // 첨부파일 — 파일별 업로드 상태 추적(업로드중/완료/실패). 완료 항목만 저장.
  // 수정 모드면 기존 첨부를 done으로 복원(그 경로는 sessionPaths에 넣지 않아 취소 시 삭제되지 않음).
  const [uploads, setUploads] = useState<Upload[]>(
    (initial?.attachments || []).map((a) => ({ key: a.path, name: a.name, size: a.size, type: a.type, status: 'done' as const, path: a.path })),
  )
  const uploading = uploads.some((u) => u.status === 'uploading')
  // 유형별 정렬(pdf→hwp→docx→xlsx→pptx→txt→image→zip→기타) — 표시용. 같은 유형은 기존 순서 유지
  const sortedUploads = useMemo(
    () => [...uploads].sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name)),
    [uploads],
  )
  // 이번 세션에 새로 올린 경로 — 취소·저장 시 스토리지 정리(기존 첨부는 미포함이라 보존).
  // 정리는 명시적 취소/저장에서만(NoticeCompose와 동일) — 수정 확인 다이얼로그(저장 2단계)와
  // 언마운트 시점이 얽혀 저장된 파일을 오삭제하지 않도록 언마운트 정리는 두지 않는다.
  const sessionPaths = useRef<Set<string>>(new Set())
  const attachCount = uploads.filter((u) => u.status !== 'error').length
  // 첨부 구역의 [파일 첨부] 추가 칩용 파일 입력(헤더 클립 버튼과 병행 — 발견성)
  const bodyFileRef = useRef<HTMLInputElement | null>(null)
  // 드래그&드롭 업로드 — 파일을 카드 위로 끌면 드롭 오버레이. dragDepth로 자식 enter/leave 상쇄
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
  // 전역 드롭 가드(적대 리뷰 반영) — 카드가 드롭을 유도하는 동안, 카드에서 몇 px 빗나간 드롭이
  // 브라우저 기본동작(탭이 로컬 파일로 내비게이션 → SPA 언로드·작성 내용 전체 유실)으로 빠지지 않게
  // window 레벨에서 파일 드래그의 dragover/drop 기본동작을 차단한다. 카드 밖은 '놓을 수 없음' 커서.
  useEffect(() => {
    const isFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onWinDragOver = (e: DragEvent) => {
      if (!isFiles(e)) return
      e.preventDefault()
      const inCard = !!(rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target))
      if (!inCard && e.dataTransfer) e.dataTransfer.dropEffect = 'none'
    }
    const onWinDrop = (e: DragEvent) => {
      if (isFiles(e)) e.preventDefault() // 카드 밖 드롭 = 무해한 no-op(내비게이션 차단)
    }
    window.addEventListener('dragover', onWinDragOver)
    window.addEventListener('drop', onWinDrop)
    return () => {
      window.removeEventListener('dragover', onWinDragOver)
      window.removeEventListener('drop', onWinDrop)
    }
  }, [])
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e) || saving) return
    e.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault() // drop 허용에 필수 — saving 중에도 호출(미호출 시 드롭이 브라우저 기본동작으로 빠짐)
    if (saving && e.dataTransfer) e.dataTransfer.dropEffect = 'none' // 저장 중엔 '놓을 수 없음' 표시
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    if (!saving) void onPickFiles(e.dataTransfer.files)
  }

  // 파일 선택 → 자리표시 후 순차 업로드(성공=done+경로, 실패=error). 한 건 실패해도 나머지 진행.
  const onPickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    const picked = Array.from(list).map((file) => ({ file, key: crypto.randomUUID() }))
    setUploads((prev) => [
      ...prev,
      ...picked.map(({ file, key }) => ({ key, name: file.name, size: file.size, type: file.type || '', status: 'uploading' as const })),
    ])
    for (const { file, key } of picked) {
      try {
        const meta = await uploadWorkFile(file)
        sessionPaths.current.add(meta.path)
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'done', path: meta.path } : u)))
      } catch (e) {
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'error', error: e instanceof Error ? e.message : '업로드 실패' } : u)))
      }
    }
  }
  // 목록에서 제거(스토리지 정리는 저장/취소 시) — 화면에서 즉시 제외
  const removeUpload = (key: string) => setUploads((prev) => prev.filter((u) => u.key !== key))

  // 입력값 존재 여부를 부모에 보고 — 뷰 전환 시 작성 중 내용 손실 방지(확인 안내). body=일반 텍스트(빈값 판정용)
  const dirty = !!(cat || title || body || mgr || start || plan || dept || time || loc || link || chief) || uploads.length > 0
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const save = () => {
    if (saving || uploading) return
    // 완료 파일만 저장 + 이번 세션에 올렸다 뺀 파일(orphan) 정리
    const attachments: NoticeFile[] = uploads
      .filter((u) => u.status === 'done' && u.path)
      .map((u) => ({ name: u.name, path: u.path as string, size: u.size, type: u.type }))
      .sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name))
    const finalPaths = new Set(attachments.map((a) => a.path))
    const orphans = [...sessionPaths.current].filter((p) => !finalPaths.has(p))
    if (orphans.length) void removeWorkFiles(orphans).catch(() => {})
    orphans.forEach((p) => sessionPaths.current.delete(p))
    onSave({ cat, title, body, bodyFmt, mgr, start, plan, dept, time, loc, link, chief, attachments })
  }

  // 취소 — 저장 안 하므로 이번 세션에 새로 올린 파일 전부 정리(기존 첨부는 보존)
  const cancel = () => {
    if (sessionPaths.current.size) void removeWorkFiles([...sessionPaths.current]).catch(() => {})
    sessionPaths.current.clear()
    onCancel()
  }

  return (
    <Box
      ref={rootRef}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={(th) => ({
        position: 'relative',
        bgcolor: alpha(th.palette.accent.green, 0.1),
        border: 1, borderColor: th.palette.accent.green,
        boxShadow: `inset 0 0 0 1px ${th.palette.accent.green}`,
        borderRadius: `${radius.card}px`, overflow: 'hidden',
      })}
    >
      {/* 드롭 오버레이 — 파일을 끌어온 동안만. pointerEvents:none이라 드롭은 루트가 받음 */}
      {dragOver && (
        <Box
          sx={(th) => ({
            position: 'absolute', inset: 6, zIndex: 2, pointerEvents: 'none',
            border: '2px dashed', borderColor: th.palette.accent.green, borderRadius: `${radius.card}px`,
            bgcolor: alpha(th.palette.accent.green, 0.14), backdropFilter: 'blur(1.5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight, color: th.palette.accent.green,
          })}
        >
          <CloudUploadIcon sx={{ fontSize: iconSize.header }} />
          여기에 놓으면 업로드
        </Box>
      )}
      {/* 헤더: 구분 · 관련부서 · 담당자 칩 + 우측 링크/첨부/저장/취소. 제목은 아래 전폭 한 줄. */}
      <Box
        sx={(th) => ({
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          bgcolor: alpha(th.palette.accent.green, 0.18),
          borderBottom: 1, borderColor: alpha(th.palette.accent.green, 0.3),
        })}
      >
        <ComboField value={cat} onChange={setCat} options={options.cats} placeholder="구분" ariaLabel="구분" sx={{ width: 112, flexShrink: 0 }} />
        <ComboField value={dept} onChange={setDept} options={options.depts} placeholder="관련부서" ariaLabel="부서" sx={{ width: 124, flexShrink: 0 }} />
        <ComboField value={mgr} onChange={setMgr} options={options.mgrs} placeholder="담당자" ariaLabel="담당자" sx={{ width: 84, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 4 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <LinkButton value={link} onChange={setLink} />
          <AttachButton count={attachCount} onFiles={onPickFiles} disabled={saving} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          <Tooltip title={uploading ? '업로드 중…' : '저장'}>
            <span>
              <IconButton size="small" aria-label="저장" onClick={save} disabled={saving || uploading} sx={(th) => ({ color: th.palette.accent.green, p: 0.5 })}>
                {saving ? <CircularProgress size={iconSize.action} thickness={5} sx={{ color: 'accent.green' }} /> : <CheckIcon sx={{ fontSize: iconSize.action }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="취소">
            <span>
              <IconButton size="small" aria-label="취소" onClick={cancel} disabled={saving || uploading} sx={{ color: 'text.secondary', p: 0.5 }}>
                <CloseIcon sx={{ fontSize: iconSize.action }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {/* 제목 — 전폭 한 줄(헤더 안에서 줄바꿈) */}
        <Field value={title} onChange={setTitle} placeholder="업무 제목" ariaLabel="업무 제목" sx={{ flexBasis: '100%', width: '100%', minWidth: 0 }} />
      </Box>

      {/* 본문 */}
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <DateField value={start} onChange={setStart} label="발의일자" ariaLabel="발의일자" sx={{ width: 116, flexShrink: 0 }} />
            <DateField value={plan} onChange={setPlan} label="예정일" ariaLabel="예정일" sx={{ width: 116, flexShrink: 0 }} />
            <TimeRangeField value={time} onChange={setTime} sx={{ width: 150, flexShrink: 0 }} />
            <ComboField value={loc} onChange={setLoc} options={options.locs} placeholder="장소" ariaLabel="장소" sx={{ width: 128, flexShrink: 0 }} />
          </Box>
          <RichContentEditor
            valueJson={initial?.bodyFmt ?? ''}
            valuePlain={initial?.body ?? ''}
            onChange={({ json, text }) => { setBody(text); setBodyFmt(json) }}
            placeholder="업무 내용 — '- '는 글머리 목록, '1. '은 번호 목록, 'ㅇ1 '은 동그라미 숫자(①)"
            disabled={saving}
            ariaLabel="업무 내용"
          />
          {/* 첨부 구역(시안 A 계열) — 점선 상단 경계 + 라벨 + 파일칩 + [파일 첨부] 추가 칩(헤더 클립과 병행).
              드래그&드롭으로도 추가 가능(카드 전체가 드롭존) */}
          <Box sx={(th) => ({ mt: 0.25, pt: 1.25, borderTop: `1px dashed ${alpha(th.palette.accent.green, 0.35)}`, display: 'flex', flexDirection: 'column', gap: 0.75 })}>
            {uploads.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AttachFileIcon sx={{ fontSize: iconSize.caption, color: 'text.disabled' }} />
                <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, letterSpacing: '0.04em', color: 'text.disabled' }}>첨부파일</Box>
                {/* 건수 = 화면의 칩 수(실패 포함) — 라벨 0인데 실패 칩이 보이는 불일치 방지(적대 리뷰) */}
                <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>{uploads.length}</Box>
              </Box>
            )}
            {uploads.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 0.75 }}>
              {sortedUploads.map((u) => {
                const err = u.status === 'error'
                return (
                  <Tooltip key={u.key} title={err ? (u.error || '업로드 실패') : u.name}>
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
                      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                        {u.status === 'uploading' ? '업로드 중' : err ? '실패' : formatBytes(u.size)}
                      </Box>
                      {u.status !== 'uploading' && (
                        <Tooltip title="첨부 제거">
                          <IconButton size="small" aria-label={`${u.name} 제거`} onClick={() => removeUpload(u.key)} sx={{ p: 0.75, my: -0.5, flex: 'none', color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
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
            {/* [파일 첨부] 추가 칩 — 상시 노출(발견성). 드래그&드롭 안내는 툴팁으로.
                span 래핑 = disabled 자식 Tooltip 에러 방지(저장/취소 버튼과 동일 패턴) */}
            <Tooltip title="파일을 카드 위로 끌어와도 업로드됩니다">
              <Box component="span" sx={{ display: 'inline-flex', width: 'fit-content' }}>
                <Box
                  component="button"
                  type="button"
                  aria-label="파일 첨부"
                  disabled={saving}
                  onClick={() => bodyFileRef.current?.click()}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5, width: 'fit-content',
                    px: 1.25, py: '4px', borderRadius: `${radius.pill}px`,
                    border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent',
                    color: 'text.secondary', font: 'inherit', fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight,
                    cursor: 'pointer', transition: `color ${motion.base}, border-color ${motion.base}`,
                    '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
                    '&:disabled': { opacity: 0.5, cursor: 'default' },
                  }}
                >
                  <AttachFileIcon sx={{ fontSize: iconSize.body }} />
                  파일 첨부
                </Box>
              </Box>
            </Tooltip>
            <input ref={bodyFileRef} type="file" multiple hidden onChange={(e) => { void onPickFiles(e.target.files); if (bodyFileRef.current) bodyFileRef.current.value = '' }} />
          </Box>
        </Box>
        {/* Check 토글 — 보라(활성)/회색(비활성), 업무 카드의 Check 칩과 동일 크기 */}
        <Box
          role="button"
          tabIndex={0}
          aria-pressed={chief}
          aria-label="검토 필요(Check) 토글"
          onClick={() => setChief((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChief((v) => !v) } }}
          sx={(th) => ({
            width: 84, height: 84, flexShrink: 0, alignSelf: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
            border: 1, borderRadius: `${radius.modal}px`, cursor: 'pointer',
            transition: 'border-color .12s, background-color .12s',
            ...(chief
              ? { borderColor: alpha(th.palette.accent.purple, 0.55), bgcolor: alpha(th.palette.accent.purple, 0.16), color: th.palette.accent.purple }
              : { borderColor: th.palette.divider, bgcolor: 'transparent', color: 'text.secondary' }),
          })}
        >
          <CheckIcon sx={{ fontSize: iconSize.header }} />
          <Box component="span" sx={{ fontWeight: typescale.cardTitle.weight, fontSize: typescale.emphasis.size }}>Check</Box>
        </Box>
      </Box>
    </Box>
  )
}
