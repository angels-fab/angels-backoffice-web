import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import Memory from '@mui/icons-material/Memory'
import Factory from '@mui/icons-material/Factory'
import LocalShipping from '@mui/icons-material/LocalShipping'
import FactCheck from '@mui/icons-material/FactCheck'
import AddIcon from '@mui/icons-material/Add'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import type { ReactNode } from 'react'
import CampaignIcon from '@mui/icons-material/Campaign'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  AppCard,
  KpiCard,
  PageHeader,
  FilterBar,
  StatusChip,
  SectionHeader,
  AppDrawer,
  EmptyState,
  SearchBar,
  ListRow,
  ConfirmDialog,
  FormDialog,
  LoadingState,
  ErrorBanner,
  FormField,
  SelectField,
  DateField,
  DataTable,
} from '@/components/ds'
import { layout } from '@/theme/tokens'

/** 쇼케이스 내 소제목 블록 */
function Demo({ name, desc, children }: { name: string; desc: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: `${layout.sectionGap}px` }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
        <Typography variant="h3" sx={{ fontFamily: 'monospace' }}>
          {name}
        </Typography>
        <Typography variant="body2">{desc}</Typography>
      </Box>
      {children}
    </Box>
  )
}

const ROW = { display: 'flex', flexWrap: 'wrap', gap: 1 } as const

/**
 * 디자인 시스템 쇼케이스 — /#/design-system (내비 미노출).
 * 1단계 공통 컴포넌트를 한 화면에서 확인하기 위한 임시 페이지.
 */
export default function DesignSystemShowcase() {
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<'all' | 'domestic' | 'foreign'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [fName, setFName] = useState('')
  const [fCat, setFCat] = useState('')
  const [fDate, setFDate] = useState('')

  return (
    <ScopedCssBaseline>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', color: 'text.primary' }}>
        <Box sx={{ maxWidth: layout.maxWidthWide, mx: 'auto', px: 3, py: 5 }}>
          <PageHeader
            title="디자인 시스템 쇼케이스"
            subtitle="1단계 공통 컴포넌트 미리보기 — 실제 페이지에는 아직 적용되지 않았습니다."
            actions={
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDrawerOpen(true)}>
                Drawer 열기
              </Button>
            }
          />

          <Divider sx={{ mb: `${layout.pageTop}px` }} />

          <Demo name="<KpiCard>" desc="숫자 중심 KPI (4단계)">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4,1fr)' }, gap: 2 }}>
              <KpiCard value={20} unit="종" label="총 도입장비" sub="29대 운영중" icon={<Memory />} accentColor="blue" />
              <KpiCard value={29} unit="대" label="운영 중" icon={<Factory />} accentColor="green" />
              <KpiCard value={4} unit="대" label="입고 예정" sub="이번 분기" icon={<LocalShipping />} accentColor="amber" />
              <KpiCard value={12} unit="건" label="점검 대상" icon={<FactCheck />} accentColor="purple" />
            </Box>
          </Demo>

          <Demo name="<FilterBar> + <StatusChip> + <SearchBar>" desc="필터 영역 (3단계)">
            <FilterBar trailing={<SearchBar value={q} onChange={setQ} placeholder="장비명 검색" />}>
              <StatusChip status="neutral" label="전체" selected={region === 'all'} onClick={() => setRegion('all')} />
              <StatusChip status="success" label="국내" selected={region === 'domestic'} onClick={() => setRegion('domestic')} />
              <StatusChip status="info" label="해외" selected={region === 'foreign'} onClick={() => setRegion('foreign')} />
            </FilterBar>
            <Box sx={ROW}>
              <StatusChip status="success" label="운영중" />
              <StatusChip status="warning" label="입고예정" />
              <StatusChip status="error" label="지연" />
              <StatusChip status="info" label="설치중" />
              <StatusChip status="purple" label="검수" />
              <StatusChip status="teal" label="예약" />
              <StatusChip status="neutral" label="미정" />
            </Box>
          </Demo>

          <Demo name="<AppCard> + <SectionHeader>" desc="기본 표면 + 섹션 제목">
            <AppCard>
              <SectionHeader title="다가오는 일정" count={5} actionLabel="전체보기" onAction={() => {}} />
              <Typography variant="body2">
                AppCard는 모든 카드/패널의 기본 표면입니다. 배경·테두리·반경·내부 padding(24px)이 통일되며,
                왼쪽 컬러 보더는 넣지 않습니다.
              </Typography>
            </AppCard>
            <Box sx={{ mt: 2 }}>
              <AppCard interactive onClick={() => {}}>
                <Typography variant="subtitle1">클릭 가능한 카드 (interactive)</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  hover 시 배경 전환 + 보더 강조 (확정 표준 — 떠오름·그림자 없음).
                </Typography>
              </AppCard>
            </Box>
          </Demo>

          <Demo name="<ListRow>" desc="목록·표의 한 행 (④ 리스트 통일) — 카드 안 divider 나열">
            <AppCard padding={0}>
              <ListRow
                leading={<CampaignIcon sx={{ fontSize: 18, color: 'accent.amber' }} />}
                title="7월 정기 안전교육 일정 안내드립니다"
                subtitle="운영지원팀 · 김담당"
                trailing={
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    07.10
                  </Typography>
                }
                divider
                onClick={() => {}}
              />
              <ListRow
                leading={<StatusChip status="error" label="NEW" />}
                title="장비 반입 동선 변경 — 클린룸 게이트 B 이용"
                subtitle="시설관리 · 이엔지니어"
                trailing={
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    07.09
                  </Typography>
                }
                divider
                onClick={() => {}}
              />
              <ListRow
                leading={<StatusChip status="success" label="국내" />}
                title="ASML TWINSCAN NXT:1980Di 노광장비 설치 검수 결과 보고 및 후속 조치 사항"
                titleTrailing={<StatusChip status="neutral" label="박연구" />}
                trailing={<ChevronRightIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                onClick={() => {}}
              />
            </AppCard>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled' }}>
              제목이 길어도 담당자 칩(titleTrailing)은 제목 바로 옆에 붙어 항상 보이고, 제목만 말줄임됩니다.
            </Typography>
          </Demo>

          <Demo name="<FormField> 패밀리" desc="폼 입력 표준 (P2-1) — modal | inline 2 variant, 날짜·Select 각 1방식">
            <AppCard>
              <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>variant="modal" — 작성폼 다이얼로그용 (테마 TextField)</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
                <FormField label="장비명" value={fName} onChange={setFName} placeholder="예: Spin Coater" />
                <SelectField label="구분" value={fCat} onChange={setFCat} options={['공정', '분석']} placeholder="선택" />
                <DateField label="설치일" value={fDate} onChange={setFDate} />
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>variant="inline" — 표 안·카드형 인라인 편집용 (미니멀 룩, 파란 포커스링)</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                <FormField variant="inline" label="장비명" value={fName} onChange={setFName} placeholder="예: Spin Coater" />
                <SelectField variant="inline" label="구분" value={fCat} onChange={setFCat} options={['공정', '분석']} placeholder="선택" />
                <DateField variant="inline" label="설치일" value={fDate} onChange={setFDate} />
              </Box>
            </AppCard>
          </Demo>

          <Demo name="<ConfirmDialog> + <FormDialog>" desc="다이얼로그 2계열 (P2-2) — 위험 작업은 빨간 버튼 강제">
            <Box sx={ROW}>
              <Button variant="outlined" size="small" onClick={() => setConfirmOpen(true)}>삭제 확인 열기 (destructive)</Button>
              <Button variant="outlined" size="small" onClick={() => setFormOpen(true)}>작성폼 열기</Button>
            </Box>
          </Demo>

          <Demo name="<DataTable>" desc="다열 데이터표 표준 (P2-3, 시안) — 헤더 12px/600 좌측정렬 · 셀 12px · hover · 모바일 가로스크롤">
            <AppCard padding={0}>
              <DataTable
                columns={[
                  { key: 'no', label: '관리번호', align: 'center', width: '1%' },
                  { key: 'name', label: '장비명' },
                  { key: 'cat', label: '분류', align: 'center', width: 80 },
                  { key: 'state', label: '상태', align: 'center', width: 100, render: (r: { state: string }) => <StatusChip status={r.state === '운영중' ? 'success' : 'neutral'} label={r.state} /> },
                  { key: 'mgr', label: '담당자', align: 'center', width: 90 },
                  // 금액·수량 등 크기 비교 열 = 우측 정렬 + 모노스페이스 (헤더도 우측 — 사용자 확정)
                  { key: 'price', label: '도입가(백만)', align: 'right', width: 110, render: (r: { price: string }) => <Box component="span" sx={{ fontFamily: 'monospace' }}>{r.price}</Box> },
                ]}
                rows={[
                  { no: 'PR-001', name: 'Laser Machine', cat: '공정', state: '도입예정', mgr: '박주봉', price: '1,250' },
                  { no: 'AN-002', name: 'SEM-FIB', cat: '분석', state: '운영중', mgr: '박세리', price: '980' },
                  { no: 'CL-001', name: 'Spin Coater', cat: '공정', state: '도입예정', mgr: '박주봉', price: '85' },
                ]}
                rowKey={(r) => r.no}
                onRowClick={() => {}}
              />
            </AppCard>
          </Demo>

          <Demo name="<LoadingState> + <ErrorBanner>" desc="피드백 표준 (P2-2)">
            <AppCard padding={0}>
              <LoadingState />
            </AppCard>
            <Box sx={{ mt: 2 }}>
              <ErrorBanner message="일정을 불러오지 못했습니다." severity="warning" onRetry={() => {}} sx={{ mb: 0 }} />
            </Box>
          </Demo>

          <Demo name="<EmptyState>" desc="빈 상태">
            <AppCard padding={0}>
              <EmptyState
                title="검색 결과가 없습니다"
                description="다른 키워드로 다시 시도해 보세요."
                icon={<SearchOffIcon />}
                action={<Button variant="outlined" size="small">필터 초기화</Button>}
              />
            </AppCard>
          </Demo>

          <Demo name="<AppDrawer>" desc="우측 슬라이드 상세 (5단계) — 상단 버튼으로 열기">
            <Typography variant="body2">
              장비/일정/업무/공지 상세를 Modal 대신 통일된 Drawer로 표시합니다. 폭 480~600px.
            </Typography>
          </Demo>
        </Box>

        <ConfirmDialog
          open={confirmOpen}
          destructive
          title="일정을 삭제할까요?"
          description="삭제 후 되돌릴 수 없습니다."
          confirmLabel="삭제"
          onConfirm={() => setConfirmOpen(false)}
          onClose={() => setConfirmOpen(false)}
        />
        <FormDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          icon={<AddIcon />}
          title="데모 항목 등록"
          footer={
            <>
              <Button variant="text" sx={{ color: 'text.secondary' }} onClick={() => setFormOpen(false)}>취소</Button>
              <Button variant="contained" onClick={() => setFormOpen(false)}>저장</Button>
            </>
          }
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormField label="이름" value={fName} onChange={setFName} />
            <SelectField label="구분" value={fCat} onChange={setFCat} options={['공정', '분석']} placeholder="선택" />
          </Box>
        </FormDialog>

        <AppDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="장비 상세"
          subtitle="ASML TWINSCAN / 노광"
          footer={
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button variant="text" onClick={() => setDrawerOpen(false)}>
                닫기
              </Button>
              <Button variant="contained">수정</Button>
            </Box>
          }
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={ROW}>
              <StatusChip status="success" label="운영중" />
              <StatusChip status="info" label="해외" />
            </Box>
            <Typography variant="body2">
              상세 본문은 스크롤되고, 헤더와 푸터는 고정됩니다. 실제 적용 시 장비 정보 테이블·이미지 등을 배치합니다.
            </Typography>
          </Box>
        </AppDrawer>
      </Box>
    </ScopedCssBaseline>
  )
}
