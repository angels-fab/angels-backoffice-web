import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  CardGrid,
  FilterBar,
  SearchBar,
  StatusChip,
  StatTile,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import { noticeCatStatus } from './noticeMeta'
import NoticeDrawer from './NoticeDrawer'
import NoticeWrite from './NoticeWrite'

const CAT_BASE_ORDER = ['긴급', '공지', '일반', '회의', '교육', '행사', '점검']

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error, updatedAt } = useAppSelector((s) => s.notice)
  const { isAdmin } = useRole()
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [writeOpen, setWriteOpen] = useState(false)

  const today = todaySeoul()
  const thisMonth = today.slice(0, 7)

  // 딥링크(/notice/:num) → 상세 드로어 대상
  const selected = useMemo(() => (num ? items.find((n) => String(n.num) === String(num)) ?? null : null), [items, num])

  // 드로어 열릴 때 1회: 조회수 증가
  useEffect(() => {
    if (ready && selected) dispatch(bumpNoticeViews(selected.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected?.id])

  const kpi = useMemo(
    () => ({
      total: items.length,
      pinned: items.filter((n) => n.pinned).length,
      month: items.filter((n) => (n.date || '').startsWith(thisMonth)).length,
      recent: items.filter((n) => n.isNew).length,
    }),
    [items, thisMonth],
  )

  const cats = useMemo(() => {
    const present = [...new Set(items.map((n) => n.cat).filter(Boolean))]
    return ['전체', ...CAT_BASE_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CAT_BASE_ORDER.includes(c))]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((n) => cat === '전체' || n.cat === cat)
      .filter((n) => !q || `${n.title} ${n.author} ${n.cat} ${n.dept} ${n.num}`.toLowerCase().includes(q))
  }, [items, cat, query])

  const refresh = () => {
    setCat('전체')
    setQuery('')
    if (num) navigate('/notice', { replace: true })
    dispatch(loadNoticeData())
  }

  const handleSaved = (savedNum: number) => {
    setWriteOpen(false)
    dispatch(loadNoticeData())
    if (savedNum > 0) navigate(`/notice/${savedNum}`, { replace: true })
  }

  const isExpired = (n: NoticeItem) => !!n.end && n.end < today

  return (
    <PageContainer>
      <PageHeader
        icon={<CampaignIcon />}
        title="공지사항"
        subtitle="팀 공지 허브"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<EditNoteIcon />} onClick={() => setWriteOpen(true)}>
                새 공지
              </Button>
            )}
            <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      {/* ① KPI */}
      <ContentSection>
        <CardGrid columns={4}>
          <StatTile value={kpi.total} unit="건" label="전체 공지" status="info" />
          <StatTile value={kpi.pinned} unit="건" label="중요 공지" status="warning" />
          <StatTile value={kpi.month} unit="건" label="이번달 공지" status="success" />
          <StatTile value={kpi.recent} unit="건" label="최근 7일" status="error" />
        </CardGrid>
      </ContentSection>

      {/* ② 분류 필터 + 검색 + 카드 목록 */}
      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·분류 검색" />}>
          {cats.map((c) => (
            <StatusChip key={c} status={c === '전체' ? 'neutral' : noticeCatStatus(c)} label={c} selected={cat === c} onClick={() => setCat(c)} />
          ))}
        </FilterBar>

        {!ready ? (
          <AppCard padding={18}><Typography variant="body2">불러오는 중…</Typography></AppCard>
        ) : filtered.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="공지사항이 없습니다" /></AppCard>
        ) : (
          <CardGrid minColWidth={300}>
            {filtered.map((n) => (
              <AppCard key={n.id} interactive onClick={() => navigate(`/notice/${n.num}`)} ariaLabel={`공지: ${n.title}`} padding={16} sx={isExpired(n) ? { opacity: 0.6 } : undefined}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} />
                    {n.pinned && <StatusChip status="warning" label="중요" />}
                    {n.isNew && <StatusChip status="error" label="NEW" />}
                    {isExpired(n) && <StatusChip status="neutral" label="만료" />}
                  </Box>
                  <Typography variant="subtitle1" sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {n.dept ? `[${n.dept}] ` : ''}{n.title}
                  </Typography>
                  <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{n.author || '-'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{n.date}</Typography>
                  </Box>
                </Box>
              </AppCard>
            ))}
          </CardGrid>
        )}
      </ContentSection>

      <NoticeDrawer notice={selected} onClose={() => navigate('/notice', { replace: true })} />
      {isAdmin && <NoticeWrite open={writeOpen} onClose={() => setWriteOpen(false)} onSaved={handleSaved} />}
    </PageContainer>
  )
}
