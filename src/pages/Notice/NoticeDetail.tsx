import { useMemo, useState } from 'react'
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
import JSZip from 'jszip'
import type { Notice, NoticeFile } from '@/types'
import { downloadNoticeBlob } from '@/api/notices'
import { AttachmentIcon, formatBytes } from './attachmentUI'
import { fileTypeRank } from './fileTypeIcons'
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
  /** 팀원+ 모드 — 수정/삭제 액션 노출 */
  canEdit?: boolean
  onEdit?: (notice: Notice) => void
  onDelete?: (notice: Notice) => void
}

/** 공지 상세 — 목록 행 아래 아코디언으로 펼쳐지는 내용(구 NoticeDrawer 대체). */
export default function NoticeDetail({ notice, canEdit, onEdit, onDelete }: NoticeDetailProps) {
  const url = refUrl(notice)
  const dept = (notice.dept || '').trim()
  const target = (notice.target || '').trim()
  const attachments = notice.attachments || []
  // 유형별 정렬(pdf→hwp→docx→xlsx→pptx→txt→image→zip→기타). 같은 유형은 기존 순서 유지(안정정렬)
  const sortedAttachments = useMemo(
    () => [...attachments].sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name)),
    [attachments],
  )
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)
  const [dlErr, setDlErr] = useState('')

  // 첨부 다운로드 — 원본 Blob을 받아 앵커 download 속성으로 저장(한글 파일명 그대로 유지).
  // 서명URL의 download 파라미터는 한글을 퍼센트 인코딩해 파일명이 깨져 blob 방식으로 처리.
  const download = async (a: NoticeFile) => {
    if (busyPath) return
    setDlErr(''); setBusyPath(a.path)
    try {
      const blob = await downloadNoticeBlob(a.path)
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = a.name || 'file'
      document.body.appendChild(el); el.click(); el.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : '다운로드에 실패했습니다')
    } finally {
      setBusyPath(null)
    }
  }

  // 모두 다운로드 — 첨부 전부를 원본 Blob으로 받아 ZIP 1개로 묶어 저장(동명 파일은 번호 부여)
  const downloadAll = async () => {
    if (zipping) return
    setDlErr(''); setZipping(true)
    try {
      const zip = new JSZip()
      const used = new Set<string>()
      for (const a of sortedAttachments) {
        const blob = await downloadNoticeBlob(a.path)
        let fname = a.name || 'file'
        if (used.has(fname)) {
          const dot = fname.lastIndexOf('.')
          const base = dot > 0 ? fname.slice(0, dot) : fname
          const ext = dot > 0 ? fname.slice(dot) : ''
          let i = 2
          while (used.has(`${base} (${i})${ext}`)) i += 1
          fname = `${base} (${i})${ext}`
        }
        used.add(fname)
        zip.file(fname, blob)
      }
      const out = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(out)
      const el = document.createElement('a')
      el.href = url
      el.download = `${(notice.title || '공지').replace(/[\\/:*?"<>|]/g, '_')}_첨부.zip`
      document.body.appendChild(el); el.click(); el.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setDlErr(e instanceof Error ? e.message : '모두 다운로드에 실패했습니다')
    } finally {
      setZipping(false)
    }
  }
  // 내용 왼쪽을 분류열(번호열 폭 뒤) 왼쪽에 정렬 — 번호열 48px + 셀 좌패딩 ≈ 64px 들여쓰기
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: '16px 18px 20px 64px', bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
      {/* 상단: (좌) 부서·해당자 / (우) 수정·삭제 아이콘. 분류칩·작성자·작성일은 제거(제목행에 분류칩 존재) */}
      {(dept || target || canEdit) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
            {dept && <MetaItem label="부서" value={dept} />}
            {target && <MetaItem label="해당자" value={target} />}
          </Box>
          {canEdit && (
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, letterSpacing: '0.04em' }}>
              첨부파일 {attachments.length}
            </Typography>
            {attachments.length > 1 && (
              <Button
                size="small" variant="text" onClick={downloadAll} disabled={zipping}
                startIcon={zipping ? <CircularProgress size={14} thickness={5} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                sx={{ fontSize: 11.5, py: 0.25, minWidth: 0 }}
              >
                {zipping ? '압축 중…' : '모두 다운로드'}
              </Button>
            )}
          </Box>
          {/* 반응형 그리드 — 창 폭/모바일 회전에 따라 열 수 자동, 각 셀은 동일 폭으로 정렬. 긴 이름은 말줄임 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 0.75 }}>
            {sortedAttachments.map((a) => (
              <Box
                key={a.path}
                role="button"
                tabIndex={0}
                aria-label={`${a.name} 다운로드`}
                title={a.name}
                onClick={() => download(a)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); download(a) } }}
                sx={(th) => ({
                  display: 'flex', alignItems: 'center', gap: 0.6, width: '100%', minWidth: 0, pl: 1, pr: 1.1, py: '6px',
                  borderRadius: '8px', border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper', cursor: 'pointer',
                  transition: 'border-color .15s, background-color .15s',
                  '&:hover': { borderColor: th.palette.primary.main, bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
                })}
              >
                {busyPath === a.path
                  ? <CircularProgress size={16} thickness={5} sx={{ flex: 'none' }} />
                  : <AttachmentIcon type={a.type} name={a.name} size={20} />}
                <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Box>
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
