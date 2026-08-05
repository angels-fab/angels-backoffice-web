import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import { AppDrawer, StatusChip, EmptyState, LoadingState, focusRingSx } from '@/components/ds'
import CampaignIcon from '@mui/icons-material/Campaign'
import { iconSize, radius, typescale } from '@/theme/tokens'

/** 처음에 보여줄 줄 수 — 진행 중 업무 카드와 같은 값(옆에 나란히 서므로 행 수가 달라지면 안 맞는다) */
const HEAD = 3
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

  const [all, setAll] = useState(false)
  // store에서 상단고정→연번 최신순 정렬됨. 3줄 = 진행 중 업무 카드와 같은 기준(옆에 나란히 서므로)
  const recent = all ? items : items.slice(0, HEAD)
  // 카드 이름이 '새 공지'이므로 건수도 **새 글**만 센다 — 전체 공지 수(17)를 쓰면 이름과 숫자가 서로 다른
  // 말을 한다(2026-08-06 사용자 지적: "17건은 총공지수인데?")
  const fresh = items.filter((n) => n.isNew).length

  return (
    <>
      <HomeCard
        icon={<CampaignIcon sx={{ fontSize: iconSize.header, color: 'accentText.amber' }} />}
        title="새 공지"
        stat={{ value: fresh, unit: '건' }}
        actionLabel="공지사항"
        onAction={() => navigate('/notice')}
      >
        {!ready ? (
          <LoadingState size="md" />
        ) : recent.length === 0 ? (
          <EmptyState size="sm" title="등록된 공지가 없습니다" />
        ) : (
          <Box>
            {recent.map((n) => (
              <HomeRow
                key={n.id}
                onClick={() => setSel(n)}
                lead={n.isNew ? <StatusChip status="error" label="NEW" /> : <StatusChip status={noticeCatStatus(n.cat)} label={n.cat} />}
                title={n.title}
                trail={<HomeMeta mono>{fmtMD(n.date)}</HomeMeta>}
              />
            ))}
            {/* '더 보기'는 진행 중 업무 카드와 같은 방식 — 나란히 서는 두 카드가 다르게 동작하면 안 된다 */}
            {items.length > HEAD && (
              <Box sx={{ pt: 1 }}>
                <ButtonBase
                  onClick={() => setAll((v) => !v)}
                  sx={{ fontSize: typescale.body.size, color: 'primary.main', px: 0.5, py: 0.25, borderRadius: `${radius.chip}px`, ...(focusRingSx as object) }}
                >
                  {all ? '접기' : `${items.length - HEAD}건 더 보기`}
                </ButtonBase>
              </Box>
            )}
          </Box>
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
