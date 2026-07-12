import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { AppCard, AppDrawer, CardGrid, StatusChip, EmptyState } from '@/components/ds'
import { radius } from '@/theme/tokens'
import { useAppSelector } from '@/store/hooks'
import type { Notice } from '@/types'
import { noticeBodyHTML, noticeCatStatus } from '@/pages/Notice/noticeMeta'

const fmtMD = (d: string) => {
  const m = String(d).match(/\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[1]}.${m[2]}` : String(d)
}

/**
 * Section 5 — 공지사항 최근 5건(카드형 리스트). 클릭 시 AppDrawer 상세(본문 DOMPurify 살균).
 */
export default function NoticeSection() {
  const navigate = useNavigate()
  const items = useAppSelector((s) => s.notice.items)
  const ready = useAppSelector((s) => s.notice.ready)
  const [sel, setSel] = useState<Notice | null>(null)

  const recent = items.slice(0, 5) // store에서 상단고정→연번 최신순 정렬됨

  if (!ready) {
    return (
      <AppCard padding={18}>
        <Typography variant="body2">불러오는 중…</Typography>
      </AppCard>
    )
  }
  if (recent.length === 0) {
    return (
      <AppCard padding={0}>
        <EmptyState size="sm" title="등록된 공지가 없습니다" />
      </AppCard>
    )
  }

  return (
    <>
      <CardGrid minColWidth={320}>
        {recent.map((n) => {
          const meta = [n.dept, n.author].filter(Boolean).join(' · ')
          return (
            <Box
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`공지: ${n.title}`}
              onClick={() => setSel(n)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSel(n)
                }
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                p: 2,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: `${radius.card}px`,
                cursor: 'pointer',
                transition: 'border-color .15s, background-color .15s, transform .15s',
                '&:hover': { borderColor: 'background.elevated', bgcolor: 'background.elevated', transform: 'translateY(-1px)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                {n.isNew ? <StatusChip status="error" label="NEW" /> : <StatusChip status={noticeCatStatus(n.cat)} label={n.cat} />}
                <Typography variant="caption" sx={{ flexShrink: 0, fontFamily: 'monospace' }}>
                  {fmtMD(n.date)}
                </Typography>
              </Box>
              <Typography
                variant="subtitle1"
                sx={{
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {n.title}
              </Typography>
              {meta && (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {meta}
                </Typography>
              )}
            </Box>
          )
        })}
      </CardGrid>

      <AppDrawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.title ?? ''}
        subtitle={sel ? `${sel.cat}${sel.dept ? ' · ' + sel.dept : ''} · ${sel.date}` : ''}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {sel?.ref && (
              <Button variant="text" onClick={() => window.open(sel.ref, '_blank', 'noopener,noreferrer')}>
                관련자료
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => {
                const num = sel?.num
                setSel(null)
                navigate(num ? `/notice/${num}` : '/notice')
              }}
            >
              공지 페이지에서 보기
            </Button>
          </Box>
        }
      >
        {sel && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <StatusChip status={sel.isNew ? 'error' : noticeCatStatus(sel.cat)} label={sel.isNew ? 'NEW' : sel.cat} />
              {sel.author && <StatusChip status="neutral" label={sel.author} />}
            </Box>
            <Box
              sx={{ fontSize: 14, lineHeight: 1.7, color: 'text.secondary', '& a': { color: 'primary.main' }, '& img': { maxWidth: '100%', borderRadius: `${radius.card}px` }, '& p': { m: 0, mb: 1 } }}
              dangerouslySetInnerHTML={{ __html: noticeBodyHTML(sel.body) }}
            />
          </Box>
        )}
      </AppDrawer>
    </>
  )
}
