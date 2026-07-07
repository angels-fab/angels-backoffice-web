import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import type { Notice, NoticeFile } from '@/types'
import { noticeFileSignedUrl } from '@/api/notices'
import { AttachmentIcon, formatBytes } from './attachmentUI'
import { noticeBodyHTML } from './noticeMeta'

const refUrl = (n: Notice) => String(n.ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" component="span" sx={{ color: 'text.disabled', flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" component="span" sx={{ color: 'text.primary' }}>{value}</Typography>
    </Box>
  )
}

export interface NoticeDetailProps {
  notice: Notice
  /** 관리자 모드 — 수정/삭제 액션 노출 */
  isAdmin?: boolean
  onEdit?: (notice: Notice) => void
  onDelete?: (notice: Notice) => void
}

/** 공지 상세 — 목록 행 아래 아코디언으로 펼쳐지는 내용(구 NoticeDrawer 대체). */
export default function NoticeDetail({ notice, isAdmin, onEdit, onDelete }: NoticeDetailProps) {
  const url = refUrl(notice)
  const dept = (notice.dept || '').trim()
  const target = (notice.target || '').trim()
  const attachments = notice.attachments || []
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [dlErr, setDlErr] = useState('')

  // 첨부 다운로드 — 비공개 버킷 서명URL(원본 파일명) 발급 후 앵커 클릭으로 저장
  const download = async (a: NoticeFile) => {
    if (busyPath) return
    setDlErr(''); setBusyPath(a.path)
    try {
      const link = await noticeFileSignedUrl(a.path, a.name)
      const el = document.createElement('a')
      el.href = link; el.rel = 'noopener'
      document.body.appendChild(el); el.click(); el.remove()
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : '다운로드에 실패했습니다')
    } finally {
      setBusyPath(null)
    }
  }
  // 내용 왼쪽을 분류열(번호열 폭 뒤) 왼쪽에 정렬 — 번호열 48px + 셀 좌패딩 ≈ 64px 들여쓰기
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: '16px 18px 20px 64px', bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
      {/* 상단: (좌) 부서·해당자 / (우) 수정·삭제 아이콘. 분류칩·작성자·작성일은 제거(제목행에 분류칩 존재) */}
      {(dept || target || isAdmin) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
            {dept && <MetaItem label="부서" value={dept} />}
            {target && <MetaItem label="해당자" value={target} />}
          </Box>
          {isAdmin && (
            <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
              <Tooltip title="수정"><IconButton size="small" aria-label="수정" onClick={() => onEdit?.(notice)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="삭제" onClick={() => onDelete?.(notice)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            </Box>
          )}
        </Box>
      )}

      <Box
        sx={{
          fontSize: 14, lineHeight: 1.7, color: 'text.secondary', borderTop: 1, borderColor: 'divider', pt: 2,
          '& a': { color: 'primary.main' },
          '& img': { maxWidth: '100%', borderRadius: 1 },
          '& p': { m: 0, mb: 1 },
          '& ul, & ol': { pl: 3, m: 0, mb: 1 },
          '& ul': { listStyle: 'disc' },
          '& ol': { listStyle: 'decimal' },
          '& li': { mb: 0.5 },
          '& li p': { m: 0 },
          '& strong, & b': { color: 'text.primary', fontWeight: 700 },
        }}
        dangerouslySetInnerHTML={{ __html: noticeBodyHTML(notice.body) }}
      />

      {attachments.length > 0 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '0.04em' }}>
            첨부파일 {attachments.length}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {attachments.map((a) => (
              <Box
                key={a.path}
                role="button"
                tabIndex={0}
                aria-label={`${a.name} 다운로드`}
                onClick={() => download(a)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); download(a) } }}
                sx={(th) => ({
                  display: 'inline-flex', alignItems: 'center', gap: 0.6, maxWidth: '100%', pl: 1, pr: 1.1, py: '6px',
                  borderRadius: '8px', border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper', cursor: 'pointer',
                  transition: 'border-color .15s, background-color .15s',
                  '&:hover': { borderColor: th.palette.primary.main, bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
                })}
              >
                {busyPath === a.path
                  ? <CircularProgress size={16} thickness={5} sx={{ flex: 'none' }} />
                  : <AttachmentIcon type={a.type} name={a.name} sx={{ fontSize: 18, color: 'primary.main', flex: 'none' }} />}
                <Box component="span" sx={{ fontSize: 12.5, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Box>
                <Box component="span" sx={{ fontSize: 11, color: 'text.disabled', flex: 'none' }}>{formatBytes(a.size)}</Box>
                <DownloadIcon sx={{ fontSize: 15, color: 'text.disabled', flex: 'none' }} />
              </Box>
            ))}
          </Box>
          {dlErr && <Box sx={{ fontSize: 11.5, color: 'error.main' }}>{dlErr}</Box>}
        </Box>
      )}

      {url && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
          <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            관련 자료
          </Button>
        </Box>
      )}
    </Box>
  )
}
