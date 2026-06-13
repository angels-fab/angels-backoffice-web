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

export { default as FilterBar } from './FilterBar'
export type { FilterBarProps } from './FilterBar'

export { default as StatusChip } from './StatusChip'
export type { StatusChipProps, StatusKind } from './StatusChip'

export { default as SectionHeader } from './SectionHeader'
export type { SectionHeaderProps } from './SectionHeader'

export { default as AppDrawer } from './AppDrawer'
export type { AppDrawerProps } from './AppDrawer'

export { default as EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { default as SearchBar } from './SearchBar'
export type { SearchBarProps } from './SearchBar'
