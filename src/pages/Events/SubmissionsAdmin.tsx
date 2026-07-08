import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ImageIcon from '@mui/icons-material/Image'
import { alpha } from '@mui/material/styles'
import { fmtEventDate } from '@/constants/events'
import { CAT_COLOR, type EventCat } from './eventCard'
import { updateSubmissionStatus, submissionPosterUrl, type EventSubmissionRow } from '@/api/events'

const STATUS_LABEL: Record<string, string> = { pending: '대기', published: '게시완료', rejected: '반려' }
const STATUS_COLOR: Record<string, string> = { pending: '#eab308', published: '#22c55e', rejected: '#ef4444' }

/**
 * 관리자용 — 팀원이 신청한 행사 목록 검토. 게시(실제 카드 등록)는 클로드에게 요청해서 진행하고,
 * 여기서는 상태(게시완료·반려)만 표시·정리한다. 포스터는 서명URL로 새 탭에서 확인.
 */
export default function SubmissionsAdmin({ open, onClose, submissions, onChanged, onError }: {
  open: boolean; onClose: () => void; submissions: EventSubmissionRow[]; onChanged: () => void; onError: (msg: string) => void
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const rank = (s: string) => (s === 'pending' ? 0 : s === 'published' ? 1 : 2)
  const sorted = [...submissions].sort((a, b) => rank(a.status) - rank(b.status) || b.id - a.id)

  const setStatus = async (id: number, status: string) => {
    setBusy(id)
    try { await updateSubmissionStatus(id, status); onChanged() } catch (e) { onError(e instanceof Error ? e.message : '상태 변경 실패') } finally { setBusy(null) }
  }
  const openPoster = async (path: string) => {
    try { const url = await submissionPosterUrl(path); window.open(url, '_blank', 'noopener,noreferrer') } catch (e) { onError(e instanceof Error ? e.message : '포스터 열기 실패') }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
      <DialogTitle>행사 신청 검토</DialogTitle>
      <DialogContent>
        <Box sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          팀원이 올린 신청입니다. 실제 게시(카드 등록)는 클로드에게 요청해서 진행하고, 여기서는 처리 상태만 표시하세요.
        </Box>
        {sorted.length === 0 ? (
          <Box sx={{ textAlign: 'center', color: 'text.disabled', py: 3, fontSize: 13 }}>신청이 없습니다.</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {sorted.map((s) => {
              const catColor = CAT_COLOR[(s.category as EventCat)] ?? '#888'
              const stColor = STATUS_COLOR[s.status] ?? '#888'
              return (
                <Box key={s.id} sx={(th) => ({ border: `1px solid ${th.palette.divider}`, borderRadius: '10px', p: 1.25, bgcolor: alpha(th.palette.text.primary, 0.02) })}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }}>
                    {s.category && <Box component="span" sx={{ fontSize: 11, fontWeight: 700, px: '8px', py: '2px', borderRadius: 999, bgcolor: catColor, color: '#fff' }}>{s.category}</Box>}
                    <Box component="span" sx={{ fontSize: 11, fontWeight: 700, px: '8px', py: '2px', borderRadius: 999, color: stColor, border: `1px solid ${stColor}` }}>{STATUS_LABEL[s.status] ?? s.status}</Box>
                    <Box sx={{ flex: 1 }} />
                    <Box component="span" sx={{ fontSize: 11.5, color: 'text.disabled' }}>{s.submitter || '-'}</Box>
                  </Box>
                  <Box sx={{ fontSize: 13.5, fontWeight: 700, color: 'text.primary', mb: 0.4 }}>{s.title || '(제목 없음)'}</Box>
                  <Box sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>
                    {(s.start || s.end) && <Box>일시: {fmtEventDate(s.start, s.end)}</Box>}
                    {s.venue && <Box>장소: {s.venue}</Box>}
                    {s.organizer && <Box>주관: {s.organizer}</Box>}
                    {s.summary.filter((x) => x.label || x.value).map((x, i) => (
                      <Box key={i}>· {x.label && <b>{x.label} </b>}{x.value}</Box>
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.link && <Button size="small" variant="text" startIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />} onClick={() => window.open(s.link, '_blank', 'noopener,noreferrer')} sx={{ fontSize: 11.5, minWidth: 0 }}>URL</Button>}
                    {s.poster && <Button size="small" variant="text" startIcon={<ImageIcon sx={{ fontSize: 15 }} />} onClick={() => void openPoster(s.poster)} sx={{ fontSize: 11.5, minWidth: 0 }}>포스터</Button>}
                    <Box sx={{ flex: 1 }} />
                    {s.status === 'pending' ? (
                      <>
                        <Button size="small" color="error" disabled={busy === s.id} onClick={() => void setStatus(s.id, 'rejected')} sx={{ fontSize: 11.5, minWidth: 0 }}>반려</Button>
                        <Button size="small" variant="contained" color="success" disabled={busy === s.id} onClick={() => void setStatus(s.id, 'published')} sx={{ fontSize: 11.5, minWidth: 0 }}>게시완료 표시</Button>
                      </>
                    ) : (
                      <Button size="small" disabled={busy === s.id} onClick={() => void setStatus(s.id, 'pending')} sx={{ fontSize: 11.5, minWidth: 0, color: 'text.secondary' }}>대기로</Button>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
