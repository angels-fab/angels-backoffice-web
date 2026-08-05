import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { AppDrawer, StatusChip, EmptyState, LoadingState } from '@/components/ds'
import CampaignIcon from '@mui/icons-material/Campaign'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { useAppSelector } from '@/store/hooks'
import type { Notice } from '@/types'
import { noticeBodyHTML, noticeCatStatus } from '@/pages/Notice/noticeMeta'
import { HomeCard, HomeRow, HomeMeta } from './HomeCard'

const fmtMD = (d: string) => {
  const m = String(d).match(/\d{4}-(\d{2})-(\d{2})/)
  return m ? `${m[1]}.${m[2]}` : String(d)
}

/**
 * 홈 '공지사항' — **한 장의 카드 안에 목록**.
 *
 * 종전에는 공지 5건이 각각 별도 카드로 흩어져 홈 한 구역을 통째로 차지했고, 카드마다 제목·칩·메타
 * 위치가 달라 눈이 갈 곳을 못 찾았다(2026-08-05 사용자: "카드 여러 개 흐트려놓지 말고 카드 안에").
 * 다른 홈 카드와 같은 규격(HomeCard/HomeRow)을 쓰므로 제목이 카드 밖으로 새지 않는다.
 * 클릭 시 상세는 종전 그대로 AppDrawer(본문 DOMPurify 살균).
 */
export default function NoticeSection() {
  const navigate = useNavigate()
  const items = useAppSelector((s) => s.notice.items)
  const ready = useAppSelector((s) => s.notice.ready)
  const [sel, setSel] = useState<Notice | null>(null)

  const recent = items.slice(0, 3) // store에서 상단고정→연번 최신순 정렬됨. 3줄 = 홈 간소화 기준(2026-08-05)

  return (
    <>
      <HomeCard
        icon={<CampaignIcon sx={{ fontSize: iconSize.header, color: 'accentText.amber' }} />}
        title="새 공지"
        count={`${items.length}건`}
        actionLabel="공지사항"
        onAction={() => navigate('/notice')}
      >
        {!ready ? (
          <LoadingState size="md" />
        ) : recent.length === 0 ? (
          <EmptyState size="sm" title="등록된 공지가 없습니다" />
        ) : (
          recent.map((n) => (
            <HomeRow
              key={n.id}
              onClick={() => setSel(n)}
              lead={n.isNew ? <StatusChip status="error" label="NEW" /> : <StatusChip status={noticeCatStatus(n.cat)} label={n.cat} />}
              title={n.title}
              trail={<HomeMeta mono>{fmtMD(n.date)}</HomeMeta>}
            />
          ))
        )}
      </HomeCard>

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
              sx={{ fontSize: typescale.emphasis.size, lineHeight: 1.7, color: 'text.secondary', '& a': { color: 'primary.main' }, '& img': { maxWidth: '100%', borderRadius: `${radius.card}px` }, '& p': { m: 0, mb: 1 } }}
              dangerouslySetInnerHTML={{ __html: noticeBodyHTML(sel.body) }}
            />
          </Box>
        )}
      </AppDrawer>
    </>
  )
}
