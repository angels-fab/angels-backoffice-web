import { useEffect, useMemo, useState } from 'react'
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
import {
  ContentSection, PageContainer, PageHeader, EmptyState, FormDialog, ConfirmDialog, ErrorBanner,
} from '@/components/ds'
import { FormField, SelectField } from '@/components/ds/fields'
import { useSnack } from '@/components/ds/snack'
import { useRole } from '@/auth/role'
import {
  RESOURCE_CATS, getResources, addResource, updateResource, deleteResource,
  type ResourceItem,
} from '@/api/resources'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'

/**
 * 자료실 (개선요청 86, 1안 카드 그리드) — 웹사이트·유용한 정보 링크 모음.
 * 중요 업무문서는 NAS 담당(사용자 방침 2026-08-14) — 업로드 없이 링크·메모 중심,
 * "일하면서 생각날 때 보는" 용도. 카드 클릭 = 새 탭으로 열기(주소 없는 정보 메모는 카드만).
 */

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

export default function Resources() {
  const { user } = useRole()
  const snack = useSnack()
  const [items, setItems] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [catFilter, setCatFilter] = useState('전체')
  // 작성/수정 다이얼로그 — editing=null 이면 신규
  const [dlg, setDlg] = useState<{ editing: ResourceItem | null } | null>(null)
  const [fCat, setFCat] = useState(RESOURCE_CATS[0])
  const [fTitle, setFTitle] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [fNote, setFNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<ResourceItem | null>(null)

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
    setFCat(RESOURCE_CATS[0]); setFTitle(''); setFUrl(''); setFNote('')
    setDlg({ editing: null })
  }
  const openEdit = (r: ResourceItem) => {
    setFCat(RESOURCE_CATS.includes(r.cat) ? r.cat : RESOURCE_CATS[0])
    setFTitle(r.title); setFUrl(r.url); setFNote(r.note)
    setDlg({ editing: r })
  }
  const save = async () => {
    if (saving) return
    if (!fTitle.trim()) return snack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      if (dlg?.editing) await updateResource(dlg.editing.num, { cat: fCat, title: fTitle, url: fUrl, note: fNote })
      else await addResource({ cat: fCat, title: fTitle, url: fUrl, note: fNote, author: user || '' })
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
      snack('자료를 삭제했습니다.', 'success')
      void load()
    } catch (e) {
      snack(e instanceof Error ? e.message : '삭제 실패', 'error')
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
        {/* 분류 칩 필터 — 시안 1안 상단 줄 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {['전체', ...RESOURCE_CATS].map((c) => {
            const active = catFilter === c
            return (
              <Box
                key={c}
                component="button"
                type="button"
                onClick={() => setCatFilter(c)}
                aria-pressed={active}
                sx={(th) => ({
                  font: 'inherit', fontSize: typescale.small.size, fontWeight: weight.semibold, cursor: 'pointer',
                  px: 1.25, py: '4px', borderRadius: `${radius.pill}px`, border: '1px solid',
                  ...(active
                    ? { bgcolor: th.palette.accent.blue, borderColor: th.palette.accent.blue, color: 'common.white' }
                    : { bgcolor: 'transparent', borderColor: th.palette.divider, color: 'text.secondary' }),
                })}
              >
                {c}
              </Box>
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 'auto', pt: 0.25, minWidth: 0 }}>
                    <Box component="span" sx={(th) => ({ fontSize: typescale.caption.size, fontWeight: weight.semibold, px: '7px', py: '2px', borderRadius: `${radius.pill}px`, bgcolor: alpha(th.palette.accent.blue, 0.14), color: th.palette.accentText.blue, flex: 'none' })}>
                      {r.cat || '기타'}
                    </Box>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.author ? `${r.author} · ` : ''}{r.date.slice(5).replace('-', '/')}
                    </Box>
                    {/* 수정·삭제 — 호버 시 표시(모바일은 항상 옅게 보임). 링크 카드 안 버튼이라 내비 전파 차단 */}
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
        onClose={() => { if (!saving) setDlg(null) }}
        icon={<LocalLibraryIcon />}
        title={dlg?.editing ? '자료 수정' : '자료 등록'}
        busy={saving}
        footer={
          <>
            <Button onClick={() => setDlg(null)} disabled={saving}>취소</Button>
            <Button variant="contained" onClick={save} disabled={saving || !fTitle.trim()}>
              {saving ? <CircularProgress size={16} thickness={5} color="inherit" /> : dlg?.editing ? '저장' : '등록'}
            </Button>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <SelectField label="분류" value={fCat} onChange={setFCat} options={RESOURCE_CATS} />
          <FormField label="제목" value={fTitle} onChange={setFTitle} autoFocus required />
          <FormField label="주소(선택)" value={fUrl} onChange={setFUrl} placeholder="https://… (비우면 링크 없는 정보 메모)" />
          <FormField label="메모(선택)" value={fNote} onChange={setFNote} multiline minRows={3} placeholder="어떤 자료인지, 언제 보면 좋은지" />
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
