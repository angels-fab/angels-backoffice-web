import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { AppDrawer, StatusChip } from '@/components/ds'
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

export interface NoticeDrawerProps {
  notice: Notice | null
  onClose: () => void
}

/** 공지 상세 Drawer — 제목·분류·작성자·작성일·본문. */
export default function NoticeDrawer({ notice, onClose }: NoticeDrawerProps) {
  const url = notice ? refUrl(notice) : null
  return (
    <AppDrawer
      open={!!notice}
      onClose={onClose}
      title={notice?.title ?? ''}
      subtitle={notice ? `${notice.cat || '공지'} · ${notice.date}` : ''}
      width={520}
      footer={
        url ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
              관련 자료 열기
            </Button>
          </Box>
        ) : undefined
      }
    >
      {notice && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
        </Box>
      )}
    </AppDrawer>
  )
}
