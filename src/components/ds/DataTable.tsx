import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import EmptyState from './EmptyState'
import LoadingState from './LoadingState'

export interface DataColumn<T> {
  key: string
  label: ReactNode
  /** 기본 left. 숫자·상태칩·액션은 center/right */
  align?: 'left' | 'center' | 'right'
  /** px 숫자 또는 '1%'(내용 폭 최소화 트릭). 미지정=자동 */
  width?: number | string
  /** 셀 렌더러. 미지정 시 row[key]를 문자열로 */
  render?: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** 빈 상태 제목 (기본 '데이터가 없습니다') */
  emptyTitle?: string
  loading?: boolean
  sx?: SxProps<Theme>
}

/**
 * DataTable — 다열 데이터표 표준 (P2-3, B#10).
 *
 * 규격(감사 4표면 4구조 → 1): MUI Table size small · 헤더 = small(12px)/600/text.secondary,
 * 좌측 정렬 기본 · 셀 = small(12px) · 행 hover = elevated · 모바일 = 가로 스크롤(기본).
 * 카드 표면은 소비처가 `<AppCard padding={0}>`로 감싼다.
 * 넓은 표의 모바일 카드 스택 변환(rtable식)은 P3 페이지 이관 시 페이지 단에서 적용.
 *
 * @example
 * <AppCard padding={0}>
 *   <DataTable columns={cols} rows={items} rowKey={(r) => r.num} onRowClick={open} />
 * </AppCard>
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyTitle = '데이터가 없습니다',
  loading,
  sx,
}: DataTableProps<T>) {
  return (
    <Box sx={{ overflowX: 'auto', ...sx }}>
      <Table
        size="small"
        sx={{
          '& th, & td': { borderColor: 'divider', whiteSpace: 'nowrap' },
        }}
      >
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                align={c.align ?? 'left'}
                sx={{ width: c.width, fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                <LoadingState size="sm" />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ border: 0 }}>
                <EmptyState size="sm" title={emptyTitle} />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                hover={!!onRowClick}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} align={c.align ?? 'left'} sx={{ fontSize: '0.75rem' }}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  )
}
