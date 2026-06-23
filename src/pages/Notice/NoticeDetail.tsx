import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { StatusChip } from '@/components/ds'
import type { Notice } from '@/types'
import { noticeBodyHTML, noticeCatStatus } from './noticeMeta'

const refUrl = (n: Notice) => String(n.ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 0 }}>{value || '-'}</Typography>
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
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: '16px 18px 20px', bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <StatusChip status={noticeCatStatus(notice.cat)} label={notice.cat || '공지'} />
        {notice.pinned && <StatusChip status="warning" label="중요" />}
        {notice.isNew && <StatusChip status="error" label="NEW" />}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <MetaRow label="작성자" value={notice.author} />
        <MetaRow label="작성일" value={notice.date} />
        {notice.dept && <MetaRow label="부서" value={notice.dept} />}
        {notice.target && <MetaRow label="해당자" value={notice.target} />}
      </Box>

      <Box
        sx={{ fontSize: 14, lineHeight: 1.7, color: 'text.secondary', borderTop: 1, borderColor: 'divider', pt: 2, '& a': { color: 'primary.main' }, '& img': { maxWidth: '100%', borderRadius: 1 }, '& p': { m: 0, mb: 1 } }}
        dangerouslySetInnerHTML={{ __html: noticeBodyHTML(notice.body) }}
      />

      {(url || isAdmin) && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
          <Box>
            {isAdmin && (
              <Button color="error" variant="text" size="small" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete?.(notice)}>
                삭제
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {url && (
              <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
                관련 자료
              </Button>
            )}
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => onEdit?.(notice)}>
                수정
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
