import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { AppDrawer, StatusChip } from '@/components/ds'
import type { EqGroup } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'

// 라벨 + 값 한 줄. 값이 비면 '미등록' 표시(빈칸 그대로 출력 금지).
function MetaRow({ label, value }: { label: string; value?: string }) {
  const v = (value ?? '').trim()
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography
        variant="body2"
        sx={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: v ? 'text.primary' : 'text.disabled' }}
      >
        {v || '미등록'}
      </Typography>
    </Box>
  )
}

// 섹션(소제목 + 행 묶음)
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>{children}</Box>
    </Box>
  )
}

const k = (v: number) => Math.round(v / 1000).toLocaleString()

export interface EqDetailDrawerProps {
  group: EqGroup | null
  onClose: () => void
}

/** 장비 상세 Drawer(조회 전용) — 기본/설치/업체/예산/기타 섹션. 편집 없음. */
export default function EqDetailDrawer({ group, onClose }: EqDetailDrawerProps) {
  const meta = group ? EQ_STATE[eqStateKey(group.state)] : null
  const codes = group ? group.codes.filter(Boolean).join(', ') : ''
  return (
    <AppDrawer
      open={!!group}
      onClose={onClose}
      title={group?.name ?? ''}
      subtitle={group ? `${group.cat || '장비'}${group.count > 1 ? ` · ${group.count}대` : ''}` : ''}
      width={520}
    >
      {group && meta && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* 상단: 상태·분류 칩 + 관리번호 */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip status={meta.status} label={meta.label} />
            {group.cat && <StatusChip status="neutral" label={group.cat} />}
            <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {codes || '관리번호 미등록'}
            </Typography>
          </Box>

          <Section title="기본 정보">
            <MetaRow label="담당자" value={group.mgr} />
            <MetaRow label="장비종류" value={group.type} />
            <MetaRow label="제조사" value={group.maker} />
            <MetaRow label="모델명" value={group.model} />
            <MetaRow label="자산번호" value={group.assetNo} />
            <MetaRow label="NFEC번호" value={group.nfec} />
          </Section>

          <Section title="설치 정보">
            <MetaRow label="설치장소" value={group.installLoc} />
            <MetaRow label="설치일자" value={group.installDate} />
          </Section>

          <Section title="업체 정보">
            <MetaRow label="업체명" value={group.vendor} />
            <MetaRow label="엔지니어" value={group.mgr2} />
            <MetaRow label="연락처" value={group.contact} />
          </Section>

          <Section title="예산 정보">
            <MetaRow label="도입금액" value={group.price ? `${k(group.price)} 천원` : ''} />
            <MetaRow label="재원" value={group.fund} />
          </Section>

          <Section title="기타">
            <MetaRow label="비고" value={group.note} />
          </Section>

          {group.count > 1 && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              ※ 자산번호·설치일자 등 개체별 항목은 대표 1대 기준입니다.
            </Typography>
          )}
        </Box>
      )}
    </AppDrawer>
  )
}
