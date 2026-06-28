import { useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import PushPinIcon from '@mui/icons-material/PushPin'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { updateImprovement } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { memosForPath } from '@/utils/improveMemo'
import type { ImprovementItem } from '@/types'

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

/** '개선 메모 N' 칩 — 제목 옆. 클릭 시 패널 토글(열 때 각 항목은 접힌 상태로 시작). */
function MemoChip({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`개선 메모 ${count}건${open ? ' 접기' : ' 펼치기'}`}
      sx={(th) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        border: `1px solid ${alpha(th.palette.accent.amber, 0.46)}`,
        borderRadius: 999,
        px: '10px',
        py: '5px',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        fontWeight: 800,
        color: th.palette.accent.amber,
        bgcolor: alpha(th.palette.accent.amber, open ? 0.2 : 0.12),
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: alpha(th.palette.accent.amber, 0.22) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      })}
    >
      <PushPinIcon sx={{ fontSize: 15 }} />
      개선 메모
      <Box
        component="span"
        sx={(th) => ({
          display: 'inline-grid',
          placeItems: 'center',
          minWidth: 18,
          height: 18,
          px: '4px',
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 800,
          bgcolor: th.palette.accent.amber,
          color: th.palette.getContrastText(th.palette.accent.amber),
        })}
      >
        {count}
      </Box>
    </Box>
  )
}

/** 메모 한 건 — 번호·제목·작성자·개선위치 + 내용 펼치기 + 메모 해제. 내용은 펼쳤을 때만 표시. */
function MemoRow({
  t, expanded, onToggleExpand, onRemove, removing,
}: {
  t: ImprovementItem
  expanded: boolean
  onToggleExpand: () => void
  onRemove: () => void
  removing: boolean
}) {
  return (
    <Box sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box component="span" sx={(th) => ({ fontSize: 11, fontWeight: 800, color: th.palette.accent.amber, fontVariantNumeric: 'tabular-nums' })}>
          요청 #{t.num}
        </Box>
        <Box component="span" sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', minWidth: 0 }}>{t.title}</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: 11, color: 'text.secondary' }}>
          <PersonOutlineIcon sx={{ fontSize: 13 }} />{t.author || '-'}
        </Box>
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: 11, color: th.palette.accent.blue, bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: 999 })}>
          <PlaceOutlinedIcon sx={{ fontSize: 13 }} />{t.loc || '-'}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          <Button
            size="small"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            startIcon={expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            sx={{ minWidth: 0, fontSize: 11.5, color: 'text.secondary', px: 1 }}
          >
            {expanded ? '내용 접기' : '내용 펼치기'}
          </Button>
          <Button
            size="small"
            color="warning"
            onClick={onRemove}
            disabled={removing}
            sx={{ minWidth: 0, fontSize: 11.5, px: 1 }}
          >
            메모 해제
          </Button>
        </Box>
      </Box>
      {expanded && (
        <Box sx={{ mt: 1, fontSize: 12.5, color: 'text.secondary', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {t.content || '내용 없음'}
        </Box>
      )}
    </Box>
  )
}

/**
 * 현재 경로의 개선 메모를 PageHeader에 결합하는 훅.
 * 반환: 제목 옆 칩 / 제목 아래 패널 / (스낵바는 관리자에게 항상 렌더 — 마지막 메모 해제 후에도 안내 유지).
 * 게스트·메모 없음 → chip/panel은 null(해당 페이지에 아무 변화 없음).
 */
export function usePageImprovementMemo(): { chip: ReactNode; panel: ReactNode; snackbar: ReactNode } {
  const { pathname } = useLocation()
  const { isAdmin, user, authKey } = useRole()
  const dispatch = useAppDispatch()
  const items = useAppSelector((s) => s.improve.items)

  const [open, setOpen] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [removingNum, setRemovingNum] = useState<string | null>(null)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const memos = useMemo(() => memosForPath(items, pathname), [items, pathname])

  const admin = isAdmin && !!user && !!authKey
  const snackbar = admin ? (
    <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
        {snack.msg}
      </Alert>
    </Snackbar>
  ) : null

  // 게스트 또는 이 페이지에 메모 없음 → 칩·패널 미표시(스낵바만 유지)
  if (!admin || memos.length === 0) return { chip: null, panel: null, snackbar }

  const toggleOpen = () => setOpen((o) => { const next = !o; if (next) setExpandedIds(new Set()); return next })
  const toggleExpand = (num: string) => setExpandedIds((prev) => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n })

  const removeMemo = async (t: ImprovementItem) => {
    if (!user || !authKey) return setSnack({ open: true, msg: '로그인이 필요합니다.', severity: 'error' })
    setRemovingNum(t.num)
    try {
      await updateImprovement({ author: user, key: authKey, num: t.num, memo: false })
      setRemovingNum(null)
      setSnack({ open: true, msg: '메모를 해제했습니다.', severity: 'success' })
      dispatch(loadImproveData())
    } catch (err) {
      setRemovingNum(null)
      setSnack({ open: true, msg: err instanceof Error ? err.message : '메모 해제 실패', severity: 'error' })
    }
  }

  const chip = <MemoChip count={memos.length} open={open} onToggle={toggleOpen} />

  const panel = open ? (
    <Box
      sx={(th) => ({
        mt: 1.25,
        border: `1px solid ${alpha(th.palette.accent.amber, 0.35)}`,
        borderRadius: '12px',
        overflow: 'hidden',
        background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.1)}, ${th.palette.background.paper} 52%)`,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 1, borderBottom: '1px solid', borderColor: (th) => alpha(th.palette.accent.amber, 0.18) }}>
        <Box sx={(th) => ({ fontSize: 12, fontWeight: 800, color: th.palette.accent.amber })}>이 화면에서 확인할 개선요청</Box>
        <Button size="small" onClick={() => setOpen(false)} sx={{ minWidth: 0, fontSize: 11.5, color: 'text.secondary', px: 1 }}>접기</Button>
      </Box>
      <Box sx={{ px: 1.75 }}>
        {memos.map((t) => (
          <MemoRow
            key={t.num}
            t={t}
            expanded={expandedIds.has(t.num)}
            onToggleExpand={() => toggleExpand(t.num)}
            onRemove={() => void removeMemo(t)}
            removing={removingNum === t.num}
          />
        ))}
      </Box>
    </Box>
  ) : null

  return { chip, panel, snackbar }
}
