import { useMemo, useState, type ReactNode } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import { SearchBar, StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { taskSubs, taskTitle, taskLink, mgrColor, catKind, deptKind } from './workMeta'
import SubLine from './SubLine'

export type DrawerTone = 'amber' | 'gray'

// 목록 높이 — 약 10행(라인 리스트 한 행 ≈ 34px)만 보이고 나머지는 스크롤
const LIST_MAX_HEIGHT = 344

export interface TaskListDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  items: WorkItem[]
  tone?: DrawerTone
  searchable?: boolean
  searchPlaceholder?: string
  /** 업무구분·관련부서 필터 칩 노출 */
  filterable?: boolean
  /** 비모달 — 배경 딤/클릭 차단 없이 메인 화면도 조작 가능(클릭 수 절감) */
  nonModal?: boolean
  isAdmin?: boolean
  onEdit?: (t: WorkItem) => void
  onComplete?: (t: WorkItem) => void
  onDelete?: (t: WorkItem) => void
  /** in-place 편집 대상 id — selTask와 같으면 상세에 편집 폼 렌더 */
  editingId?: number | null
  /** 편집 폼 렌더(상세 in-place 편집용) */
  renderEdit?: (t: WorkItem) => ReactNode
}

/**
 * TaskListDrawer — 업무를 우측 드로어로 표시.
 * 상단: (선택)검색 + 1열 라인 리스트(약 10행, 스크롤) / 하단: 선택 업무 내용.
 * Remind(amber)·완료(gray) 등에 공용.
 */
export default function TaskListDrawer({
  open, onClose, title, items, tone = 'amber', searchable, searchPlaceholder, filterable, nonModal,
  isAdmin, onEdit, onComplete, onDelete, editingId, renderEdit,
}: TaskListDrawerProps) {
  const theme = useTheme()
  const accent = tone === 'amber' ? theme.palette.accent.amber : theme.palette.text.secondary
  const [sel, setSel] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [catSel, setCatSel] = useState('') // '' = 전체(미선택)

  // 업무구분 필터 후보 ('전체' 칩 없음 — 재선택 시 해제로 전체 표시)
  const cats = useMemo(() => [...new Set(items.map((t) => t.cat).filter(Boolean))].sort((a, b) => workCatRank(a) - workCatRank(b)), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((t) => !catSel || normCat(t.cat) === normCat(catSel))
      .filter((t) => !(searchable && q) || `${t.task} ${t.mgr} ${t.cat} ${t.dept}`.toLowerCase().includes(q))
  }, [items, query, searchable, catSel])

  const selTask = items.find((t) => t.id === sel) ?? null
  const close = () => { setSel(null); setQuery(''); setCatSel(''); onClose() }
  const toggle = (id: number) => setSel((s) => (s === id ? null : id))

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={close}
      hideBackdrop={nonModal}
      ModalProps={nonModal ? { disableEnforceFocus: true, disableScrollLock: true } : undefined}
      sx={nonModal ? { pointerEvents: 'none' } : undefined}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', ...(nonModal ? { pointerEvents: 'auto' } : {}) } } }}
    >
      <Box sx={{ width: { xs: '100vw', sm: 460 }, maxWidth: '100vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 2, bgcolor: 'background.elevated', borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h3">{title}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{searchable && query ? `${filtered.length}/${items.length}` : items.length}건</Typography>
          </Box>
          <IconButton onClick={close} size="small" aria-label="닫기" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* 검색 + 업무구분·관련부서 필터 */}
        {(searchable || filterable) && (
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {searchable && <SearchBar value={query} onChange={setQuery} placeholder={searchPlaceholder ?? '검색'} />}
            {filterable && cats.length > 1 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {cats.map((c) => <StatusChip key={c} status={catKind(c)} label={c} selected={catSel === c} onClick={() => setCatSel((s) => (s === c ? '' : c))} />)}
              </Box>
            )}
          </Box>
        )}

        {/* 목록(상단, 약 10행 + 스크롤, 라인 리스트) */}
        <Box sx={{ p: 1.25, flexShrink: 0 }}>
          <Box sx={{ maxHeight: LIST_MAX_HEIGHT, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {filtered.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.disabled', py: 3, textAlign: 'center' }}>{query ? '검색 결과가 없습니다' : '업무가 없습니다'}</Typography>
            ) : (
              filtered.map((t, i) => {
                const on = sel === t.id
                return (
                  <Box
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    aria-label={`업무: ${taskTitle(t)}`}
                    onClick={() => toggle(t.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t.id) } }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0,
                      px: 1.25, py: 0.75, cursor: 'pointer',
                      borderTop: i === 0 ? 0 : 1, borderColor: 'divider',
                      bgcolor: on ? alpha(accent, 0.16) : 'transparent',
                      transition: 'background-color .15s',
                      '&:hover': { bgcolor: on ? alpha(accent, 0.16) : alpha(accent, 0.06) },
                    }}
                  >
                    {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
                    {t.dept && <StatusChip status={deptKind(t.dept)} label={t.dept} />}
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {taskTitle(t)}
                    </Typography>
                  </Box>
                )
              })
            )}
          </Box>
        </Box>

        {/* 내용(하단) — 선택 시 상세, 아니면 안내 */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2, ...(selTask ? { borderTop: 2, borderColor: alpha(accent, 0.4), bgcolor: alpha(accent, 0.06) } : {}) }}>
          {selTask ? (
            editingId === selTask.id && renderEdit ? (
              renderEdit(selTask)
            ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{taskTitle(selTask)}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Box component="span" sx={{ fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1, py: 0.3, bgcolor: mgrColor(selTask.mgr), color: '#fff', whiteSpace: 'nowrap' }}>{selTask.mgr || '미지정'}</Box>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(selTask.start)}</Typography>
                </Box>
              </Box>
              {/* 구분·부서 칩 줄 — 우측에 수정/삭제 아이콘(날짜 아래, 같은 행 우측) */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                  {selTask.cat && <StatusChip status={catKind(selTask.cat)} label={selTask.cat} />}
                  {selTask.dept && <StatusChip status={deptKind(selTask.dept)} label={selTask.dept} />}
                </Box>
                {isAdmin && (onEdit || onDelete) && (
                  <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                    {onEdit && <IconButton size="small" aria-label="수정" onClick={() => onEdit(selTask)} sx={{ color: 'text.secondary' }}><EditOutlinedIcon sx={{ fontSize: 19 }} /></IconButton>}
                    {onDelete && <IconButton size="small" aria-label="삭제" onClick={() => onDelete(selTask)} sx={{ color: 'error.main' }}><DeleteOutlineIcon sx={{ fontSize: 19 }} /></IconButton>}
                  </Box>
                )}
              </Box>
              {(() => {
                const subs = taskSubs(selTask)
                const link = taskLink(selTask)
                return (
                  <>
                    {subs.length > 0 ? (
                      <Box>{subs.map((l, k) => <SubLine key={k} line={l} />)}</Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
                    )}
                    {(selTask.plan || selTask.end || link) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                        {selTask.plan && <Typography variant="caption" sx={{ color: 'text.secondary' }}>예정 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(selTask.plan)}</Box></Typography>}
                        {selTask.end && <Typography variant="caption" sx={{ color: 'text.secondary' }}>완료 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(selTask.end)}</Box></Typography>}
                        {link && (
                          <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" sx={{ color: 'text.secondary' }}>
                            <OpenInNewIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </>
                )
              })()}
              {isAdmin && (selTask.status || '').trim() !== '완료' && onComplete && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => onComplete(selTask)}>완료</Button>
                </Box>
              )}
            </>
            )
          ) : (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', mt: 1 }}>목록에서 업무를 선택하면 내용이 표시됩니다</Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  )
}
