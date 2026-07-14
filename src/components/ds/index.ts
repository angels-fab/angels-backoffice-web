/**
 * 디자인 시스템 공통 컴포넌트 배럴.
 *
 * 사용: import { AppCard, KpiCard, PageHeader } from '@/components/ds'
 * 문서: docs/design-system.md
 */
export { default as AppCard } from './AppCard'
export type { AppCardProps } from './AppCard'

export { default as KpiCard } from './KpiCard'
export type { KpiCardProps } from './KpiCard'

export { default as PageHeader } from './PageHeader'
export type { PageHeaderProps } from './PageHeader'

// ── Layout System (STEP 3) ──
export { default as AppLayout } from './AppLayout'
export type { AppLayoutProps } from './AppLayout'

export { default as PageContainer } from './PageContainer'
export type { PageContainerProps } from './PageContainer'

export { default as ContentSection } from './ContentSection'
export type { ContentSectionProps } from './ContentSection'

export { default as CardGrid } from './CardGrid'
export type { CardGridProps } from './CardGrid'

export { default as RatioBar } from './RatioBar'
export type { RatioBarProps, RatioSegment } from './RatioBar'

export { default as StatTile } from './StatTile'
export type { StatTileProps } from './StatTile'

export { default as FilterBar } from './FilterBar'
export type { FilterBarProps } from './FilterBar'

export { default as FilterToolbar } from './FilterToolbar'
export type { FilterToolbarProps } from './FilterToolbar'

export { default as StatusChip } from './StatusChip'
export type { StatusChipProps, StatusKind } from './StatusChip'

export { default as SegTabs } from './SegTabs'
export type { SegTabsProps, SegTabItem } from './SegTabs'

export { default as ManagerChip } from './ManagerChip'
export type { ManagerChipProps } from './ManagerChip'

export { default as SectionHeader } from './SectionHeader'
export type { SectionHeaderProps } from './SectionHeader'

export { default as AppDrawer } from './AppDrawer'
export type { AppDrawerProps } from './AppDrawer'

export { default as EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { default as SearchBar } from './SearchBar'
export type { SearchBarProps } from './SearchBar'

export { default as ListRow } from './ListRow'
export type { ListRowProps } from './ListRow'

// ── P2: 오버레이·피드백 표준 (B#6·B#7) ──
export { default as ConfirmDialog } from './ConfirmDialog'
export type { ConfirmDialogProps } from './ConfirmDialog'

export { default as FormDialog } from './FormDialog'
export type { FormDialogProps } from './FormDialog'

export { default as LoadingState } from './LoadingState'
export type { LoadingStateProps } from './LoadingState'

export { default as ErrorBanner } from './ErrorBanner'
export type { ErrorBannerProps } from './ErrorBanner'

export { SnackProvider, useSnack } from './snack'

export { focusRingSx } from './focus'

export { default as NavBadge } from './NavBadge'
export type { NavBadgeProps } from './NavBadge'

export { default as DataTable } from './DataTable'
export type { DataTableProps, DataColumn } from './DataTable'

export { dataTableHeadSx, dataTableSx } from './tableStyle'

// ── P2-1: 폼 필드 표준 (D4 — 단일 구현 + modal|inline variant) ──
export { FormField, SelectField, DateField, TimeField, inlineFieldSx } from './fields'
export type { FormFieldProps, SelectFieldProps, FieldVariant } from './fields'
