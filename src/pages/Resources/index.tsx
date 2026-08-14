import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import { alpha } from '@mui/material/styles'
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary'
import AddIcon from '@mui/icons-material/Add'
import PublicIcon from '@mui/icons-material/Public'
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import CloseIcon from '@mui/icons-material/Close'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import AppsIcon from '@mui/icons-material/Apps'
import type { SvgIconComponent } from '@mui/icons-material'
import type { Theme } from '@mui/material/styles'
import { TintChip } from '@/components/FilterChip'
import {
  ContentSection, PageContainer, PageHeader, EmptyState, FormDialog, ConfirmDialog, ErrorBanner,
} from '@/components/ds'
import { FormField } from '@/components/ds/fields'
import { useSnack } from '@/components/ds/snack'
import { useRole } from '@/auth/role'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import {
  RESOURCE_CATS, RESOURCE_FILE_MAX, getResources, addResource, updateResource, deleteResource,
  uploadResourceFile, downloadResourceBlob, removeResourceFiles,
  type ResourceItem, type ResourceFile,
} from '@/api/resources'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'

/**
 * 자료실 (개선요청 86, 1안 카드 그리드) — 웹사이트·유용한 정보 링크 모음 + 첨부(50MB).
 * 중요 업무문서는 NAS 담당(사용자 방침 2026-08-14) — "일하면서 생각날 때 보는" 용도.
 * 카드 클릭 = 새 탭으로 열기(주소 없는 정보 메모는 카드만), 첨부 칩 = 원본 다운로드.
 * 등록창 배치(사용자 지시 2026-08-15): 분류=제목 옆 칩(필수) / 제목 → 내용 / 하단에 주소·첨부(드래그앤드랍).
 */

/**
 * 분류별 색·아이콘 — 업무일정 종류칩(CalFilterBar CatChip)·업무현황 구분칩과 같은 문법
 * (TintChip 틴트 .18/테두리 .6/높이 24, 아이콘 13px raw accent — 사용자 지시 2026-08-15 디자인 채택).
 */
const CAT_META: Record<string, { color: (t: Theme) => string; icon: SvgIconComponent }> = {
  '업무': { color: (t) => t.palette.accent.blue, icon: WorkIcon },
  '교육': { color: (t) => t.palette.accent.green, icon: SchoolIcon },
  '참고': { color: (t) => t.palette.accent.purple, icon: MenuBookIcon },
  '기타': { color: (t) => t.palette.text.secondary, icon: MoreHorizIcon },
}
const catMetaOf = (cat: string) => CAT_META[cat] ?? CAT_META['기타']

/** 주소에서 도메인(host) — 파비콘·캡션용. 프로토콜 없이 적어도 통하게 보정 */
function hostOf(url: string): string {
  try {
    return new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
function hrefOf(url: string): string {
  return url.includes('://') ? url : `https://${url}`
}

/** 작성 중 첨부 1건 상태 — 완료(done)만 저장 대상(공지 폼과 같은 규칙) */
type Upload = {
  key: string
  name: string
  size: number
  type: string
  status: 'uploading' | 'done' | 'error'
  path?: string
  error?: string
}

export default function Resources() {
  const { user } = useRole()
  const snack = useSnack()
  const [items, setItems] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catFilter, setCatFilter] = useState('전체')
  // 작성/수정 다이얼로그 — editing=null 이면 신규. 분류는 필수(빈 값이면 등록 잠김)
  const [dlg, setDlg] = useState<{ editing: ResourceItem | null } | null>(null)
  const [fCat, setFCat] = useState('')
  const [fTitle, setFTitle] = useState('')
  const [fNote, setFNote] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragOver, setDragOver] = useState(false)
  const sessionPaths = useRef<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<ResourceItem | null>(null)
  const uploading = uploads.some((u) => u.status === 'uploading')

  const load = async () => {
    try {
      setError('')
      setItems(await getResources())
    } catch (e) {
      setError(e instanceof Error ? e.message : '자료 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const filtered = useMemo(
    () => (catFilter === '전체' ? items : items.filter((r) => r.cat === catFilter)),
    [items, catFilter],
  )

  const openNew = () => {
    setFCat(''); setFTitle(''); setFNote(''); setFUrl('')
    setUploads([]); sessionPaths.current = new Set()
    setDlg({ editing: null })
  }
  const openEdit = (r: ResourceItem) => {
    setFCat(RESOURCE_CATS.includes(r.cat) ? r.cat : '')
    setFTitle(r.title); setFNote(r.note); setFUrl(r.url)
    setUploads(r.attachments.map((a) => ({ key: a.path, name: a.name, size: a.size, type: a.type, status: 'done' as const, path: a.path })))
    sessionPaths.current = new Set()
    setDlg({ editing: r })
  }

  // 파일 선택/드랍 공용 — 파일별 자리 먼저 만들고 순차 업로드(한 건 실패해도 나머지 진행, 공지와 동일)
  const pickFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list || [])
    if (files.length === 0) return
    const picked = files.map((file) => ({ file, key: crypto.randomUUID() }))
    setUploads((prev) => [
      ...prev,
      ...picked.map(({ file, key }) => ({ key, name: file.name, size: file.size, type: file.type || '', status: 'uploading' as const })),
    ])
    for (const { file, key } of picked) {
      try {
        const meta = await uploadResourceFile(file)
        sessionPaths.current.add(meta.path)
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'done', path: meta.path } : u)))
      } catch (e) {
        setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, status: 'error', error: e instanceof Error ? e.message : '업로드 실패' } : u)))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
  const removeUpload = (key: string) => setUploads((prev) => prev.filter((u) => u.key !== key))

  const closeDialog = (cancelled: boolean) => {
    if (cancelled) {
      // 취소 — 이번에 새로 올린 파일은 저장 안 되므로 정리(기존 첨부는 보존)
      const news = Array.from(sessionPaths.current)
      if (news.length) void removeResourceFiles(news).catch(() => {})
    }
    setDlg(null)
  }

  const save = async () => {
    if (saving) return
    if (!fCat) return snack('분류를 선택해주세요.', 'error')
    if (!fTitle.trim()) return snack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      const attachments: ResourceFile[] = uploads
        .filter((u) => u.status === 'done' && u.path)
        .map((u) => ({ name: u.name, path: u.path as string, size: u.size, type: u.type }))
      // 이번 세션에 올렸다 뺀 파일 + (수정 시) 기존 첨부 중 제거된 파일 = orphan 정리
      const finalPaths = new Set(attachments.map((a) => a.path))
      const orphans = [
        ...Array.from(sessionPaths.current).filter((p) => !finalPaths.has(p)),
        ...(dlg?.editing?.attachments || []).map((a) => a.path).filter((p) => !finalPaths.has(p)),
      ]
      if (dlg?.editing) await updateResource(dlg.editing.num, { cat: fCat, title: fTitle, url: fUrl, note: fNote, attachments })
      else await addResource({ cat: fCat, title: fTitle, url: fUrl, note: fNote, attachments, author: user || '' })
      if (orphans.length) void removeResourceFiles(orphans).catch(() => {})
      setDlg(null)
      snack(dlg?.editing ? '자료를 수정했습니다.' : '자료를 등록했습니다.', 'success')
      void load()
    } catch (e) {
      snack(e instanceof Error ? e.message : '저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }
  const doDelete = async () => {
    const target = confirmDel
    if (!target) return
    setConfirmDel(null)
    try {
      await deleteResource(target.num)
      // 자료가 지워졌으면 그 첨부도 정리(best-effort)
      if (target.attachments.length) void removeResourceFiles(target.attachments.map((a) => a.path)).catch(() => {})
      snack('자료를 삭제했습니다.', 'success')
      void load()
    } catch (e) {
      snack(e instanceof Error ? e.message : '삭제 실패', 'error')
    }
  }
  // 첨부 다운로드 — Blob + 앵커 download(한글 파일명 유지, 공지와 동일 방식)
  const downloadFile = async (a: ResourceFile) => {
    try {
      const blob = await downloadResourceBlob(a.path)
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = a.name || 'file'
      document.body.appendChild(el); el.click(); el.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      snack(e instanceof Error ? e.message : '다운로드 실패', 'error')
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<LocalLibraryIcon />}
        title="자료실"
        actions={
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openNew}>
            자료 등록
          </Button>
        }
      />
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); void load() }} />}
      <ContentSection last>
        {/* 분류 칩 필터 — 업무일정 종류칩과 같은 TintChip 규격(사용자 지시 2026-08-15) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          <TintChip
            on={catFilter === '전체'}
            color={(t: Theme) => t.palette.text.secondary}
            hover
            ariaLabel={`전체 ${items.length}건`}
            onToggle={() => setCatFilter('전체')}
            sx={{ p: '4px 9px' }}
          >
            <AppsIcon sx={{ fontSize: iconSize.caption, color: 'text.secondary' }} />
            <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, color: catFilter === '전체' ? 'text.primary' : 'text.secondary' }}>전체</Box>
            <Box component="span" sx={{ fontSize: typescale.small.size, color: 'text.secondary' }}>{items.length}</Box>
          </TintChip>
          {RESOURCE_CATS.map((c) => {
            const meta = catMetaOf(c)
            const Icon = meta.icon
            const on = catFilter === c
            const count = items.filter((r) => r.cat === c).length
            return (
              <TintChip
                key={c}
                on={on}
                color={meta.color}
                hover
                ariaLabel={`${c} ${count}건${on ? '' : ' (해제됨)'}`}
                onToggle={() => setCatFilter(on ? '전체' : c)}
                sx={{ p: '4px 9px' }}
              >
                <Icon sx={(t: Theme) => ({ fontSize: iconSize.caption, color: meta.color(t) })} />
                <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, color: on ? 'text.primary' : 'text.secondary' }}>{c}</Box>
                <Box component="span" sx={{ fontSize: typescale.small.size, color: 'text.secondary' }}>{count}</Box>
              </TintChip>
            )
          })}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<LocalLibraryIcon />}
            title={items.length === 0 ? '아직 자료가 없습니다' : '이 분류에 자료가 없습니다'}
            description={items.length === 0 ? '일하면서 참고할 웹사이트나 유용한 정보를 등록해보세요.' : undefined}
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 1.5 }}>
            {filtered.map((r) => {
              const host = hostOf(r.url)
              const clickable = !!r.url.trim()
              return (
                <Box
                  key={r.num}
                  {...(clickable
                    ? { component: 'a', href: hrefOf(r.url), target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  sx={(th) => ({
                    position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75,
                    p: '12px 14px', textDecoration: 'none', color: 'text.primary',
                    bgcolor: 'background.paper', border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.card}px`,
                    transition: 'border-color .15s, background-color .15s',
                    ...(clickable && {
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'background.elevated', borderColor: alpha(th.palette.primary.main, 0.65) },
                    }),
                    '&:hover .rs-acts': { opacity: 1 },
                  })}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {clickable ? (
                      <>
                        {/* 파비콘 — 구글 서비스가 막힌 망이면 지구본으로 대체(onError) */}
                        <Box
                          component="img"
                          src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
                          alt=""
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; e.currentTarget.nextElementSibling?.removeAttribute('data-hidden') }}
                          sx={{ width: 16, height: 16, flex: 'none' }}
                        />
                        <PublicIcon data-hidden="" sx={{ fontSize: iconSize.body, color: 'text.disabled', flex: 'none', '&[data-hidden]': { display: 'none' } }} />
                        <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {host}
                        </Box>
                        <OpenInNewIcon sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none' }} />
                      </>
                    ) : (
                      <>
                        <StickyNote2OutlinedIcon sx={{ fontSize: iconSize.body, color: 'text.disabled', flex: 'none' }} />
                        <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>정보 메모</Box>
                      </>
                    )}
                  </Box>
                  <Box sx={{ fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                    {r.title}
                  </Box>
                  {r.note && (
                    <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, whiteSpace: 'pre-wrap' }}>
                      {r.note}
                    </Box>
                  )}
                  {/* 첨부 칩 — 카드가 링크(<a>)여도 칩 클릭은 다운로드만(전파 차단) */}
                  {r.attachments.length > 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {r.attachments.map((a) => (
                        <Box
                          key={a.path}
                          component="button"
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void downloadFile(a) }}
                          sx={(th) => ({
                            font: 'inherit', textAlign: 'left', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, pl: 0.75, pr: 1, py: '3px',
                            borderRadius: `${radius.chip}px`, bgcolor: alpha(th.palette.text.primary, 0.05),
                            border: `1px solid ${th.palette.divider}`, color: 'text.primary',
                            '&:hover': { borderColor: th.palette.primary.main },
                          })}
                        >
                          <AttachmentIcon type={a.type} name={a.name} size={16} />
                          <Box component="span" sx={{ fontSize: typescale.small.size, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.name}
                          </Box>
                          <Box component="span" sx={{ ml: 'auto', fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none' }}>
                            {formatBytes(a.size)}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 'auto', pt: 0.25, minWidth: 0 }}>
                    {/* 카드 분류칩 — 필터칩과 같은 색 문법(틴트 .18/테두리 .6), 작게 */}
                    <Box component="span" sx={(th) => { const c = catMetaOf(r.cat).color(th); return { fontSize: typescale.caption.size, fontWeight: weight.semibold, px: '7px', py: '2px', borderRadius: `${radius.pill}px`, bgcolor: alpha(c, 0.18), border: `1px solid ${alpha(c, 0.6)}`, color: 'text.primary', flex: 'none' } }}>
                      {r.cat || '기타'}
                    </Box>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.author ? `${r.author} · ` : ''}{r.date.slice(5).replace('-', '/')}
                    </Box>
                    {/* 수정·삭제 — 호버 시 표시(모바일은 항상 보임). 링크 카드 안 버튼이라 내비 전파 차단 */}
                    <Box className="rs-acts" /* design-lint-ok(class): 부모 sx '&:hover .rs-acts' 호버 타깃 — 전역 CSS 아님(Links lk-ext 동일 패턴) */ sx={{ ml: 'auto', display: 'flex', gap: 0.25, opacity: { xs: 1, shell: 0 }, transition: 'opacity .15s' }}>
                      <Tooltip title="수정">
                        <IconButton
                          size="small" aria-label="자료 수정"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(r) }}
                          sx={{ p: '3px', color: 'text.disabled' }}
                        >
                          <EditIcon sx={{ fontSize: iconSize.caption }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="삭제">
                        <IconButton
                          size="small" aria-label="자료 삭제"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDel(r) }}
                          sx={{ p: '3px', color: 'text.disabled' }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: iconSize.caption }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </ContentSection>

      <FormDialog
        open={!!dlg}
        onClose={() => { if (!saving) closeDialog(true) }}
        icon={<LocalLibraryIcon />}
        title={dlg?.editing ? '자료 수정' : '자료 등록'}
        busy={saving}
        titleExtra={
          /* 분류 = 제목 옆 필수 칩(TintChip 단일선택) — 안 고르면 등록 잠김 */
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
            {RESOURCE_CATS.map((c) => {
              const meta = catMetaOf(c)
              const Icon = meta.icon
              const on = fCat === c
              return (
                <TintChip key={c} on={on} color={meta.color} hover ariaLabel={`분류 ${c}`} onToggle={() => setFCat(c)} sx={{ p: '4px 9px' }}>
                  <Icon sx={(t: Theme) => ({ fontSize: iconSize.caption, color: meta.color(t) })} />
                  <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, color: on ? 'text.primary' : 'text.secondary' }}>{c}</Box>
                </TintChip>
              )
            })}
          </Box>
        }
        footer={
          <>
            <Button onClick={() => closeDialog(true)} disabled={saving}>취소</Button>
            <Button variant="contained" onClick={save} disabled={saving || uploading || !fTitle.trim() || !fCat}>
              {saving ? <CircularProgress size={16} thickness={5} color="inherit" /> : dlg?.editing ? '저장' : '등록'}
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <FormField label="제목" value={fTitle} onChange={setFTitle} autoFocus required />
          <FormField label="내용(선택)" value={fNote} onChange={setFNote} multiline minRows={3} placeholder="어떤 자료인지, 언제 보면 좋은지" />
          {/* 하단 — 주소·첨부(사용자 지시 배치) */}
          <FormField label="주소(선택)" value={fUrl} onChange={setFUrl} placeholder="https://… (비우면 링크 없는 정보 카드)" />
          <Box>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
            <Box
              role="button" tabIndex={0} aria-label="파일 첨부"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); void pickFiles(e.dataTransfer.files) }}
              sx={(th) => ({
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 2, px: 1.5,
                borderRadius: `${radius.input}px`, border: '1.5px dashed', cursor: 'pointer', textAlign: 'center',
                transition: 'border-color .15s, background-color .15s',
                ...(dragOver
                  ? { borderColor: th.palette.primary.main, bgcolor: alpha(th.palette.primary.main, 0.06) }
                  : { borderColor: th.palette.divider, '&:hover': { borderColor: th.palette.primary.main } }),
              })}
            >
              <UploadFileIcon sx={{ fontSize: iconSize.header, color: 'text.disabled' }} />
              <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary' }}>
                파일을 끌어다 놓거나 눌러서 선택
              </Box>
              <Box sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>
                파일당 최대 {Math.round(RESOURCE_FILE_MAX / 1024 / 1024)}MB
              </Box>
            </Box>
            {uploads.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.75 }}>
                {uploads.map((u) => {
                  const err = u.status === 'error'
                  return (
                    <Box
                      key={u.key}
                      sx={(th) => ({
                        display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, pl: 0.75, pr: 0.25, py: '3px',
                        borderRadius: `${radius.chip}px`,
                        bgcolor: err ? alpha(th.palette.error.main, 0.08) : alpha(th.palette.text.primary, 0.05),
                        border: `1px solid ${err ? alpha(th.palette.error.main, 0.5) : th.palette.divider}`,
                      })}
                    >
                      {u.status === 'uploading'
                        ? <CircularProgress size={14} thickness={5} />
                        : err
                          ? <ErrorOutlineIcon color="error" sx={{ fontSize: iconSize.body }} />
                          : <AttachmentIcon type={u.type} name={u.name} size={16} />}
                      <Box component="span" sx={{ fontSize: typescale.small.size, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: err ? 'error.main' : 'text.primary' }}>
                        {u.name}
                      </Box>
                      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none' }}>
                        {err ? (u.error || '업로드 실패') : formatBytes(u.size)}
                      </Box>
                      <IconButton size="small" aria-label={`${u.name} 제거`} onClick={() => removeUpload(u.key)} sx={{ ml: 'auto', p: '2px', color: 'text.disabled' }}>
                        <CloseIcon sx={{ fontSize: iconSize.caption }} />
                      </IconButton>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Box>
        </Box>
      </FormDialog>

      <ConfirmDialog
        open={!!confirmDel}
        title="자료를 삭제할까요?"
        description={confirmDel?.title}
        confirmLabel="삭제"
        destructive
        onConfirm={doDelete}
        onClose={() => setConfirmDel(null)}
      />
    </PageContainer>
  )
}
