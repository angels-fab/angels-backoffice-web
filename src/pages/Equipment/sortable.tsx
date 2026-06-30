import { useState } from 'react'
import Box from '@mui/material/Box'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'

export type SortDir = 'asc' | 'desc'

/** 목록형 헤더 정렬 상태 — 첫 클릭 asc, 같은 열 재클릭 desc, 다른 열 클릭 asc */
export function useTableSort<K extends string>(initial: K | null = null) {
  const [col, setCol] = useState<K | null>(initial)
  const [dir, setDir] = useState<SortDir>('asc')
  const onSort = (c: K) => {
    if (c === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setCol(c); setDir('asc') }
  }
  return { col, dir, onSort }
}

/**
 * 정렬 — 숫자는 숫자값, 그 외는 한글 우선 문자열 비교. 빈값(null·'')은 방향과 무관하게 항상 끝.
 * accessor가 null/''을 반환하면 빈값으로 취급. (검색·필터가 적용된 결과 위에서 호출)
 */
export function sortRows<T, K extends string>(
  rows: T[],
  col: K | null,
  dir: SortDir,
  accessor: (row: T, col: K) => string | number | null | undefined,
): T[] {
  if (!col) return rows
  const sign = dir === 'asc' ? 1 : -1
  const val = (r: T) => { const v = accessor(r, col); return v === '' || v == null ? null : v }
  return [...rows].sort((a, b) => {
    const av = val(a), bv = val(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1 // 빈값은 항상 끝(방향 무관)
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign
    return String(av).localeCompare(String(bv), 'ko') * sign
  })
}

/** 정렬 가능한 <th> — 현재 정렬 열·방향을 MUI 아이콘으로 표시 */
export function SortTh({ label, colKey, active, dir, onSort, right }: {
  label: string
  colKey: string
  active: boolean
  dir: SortDir
  onSort: (c: string) => void
  right?: boolean
}) {
  return (
    <Box
      component="th"
      onClick={() => onSort(colKey)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', '&:hover': { color: 'text.secondary' } }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, justifyContent: right ? 'flex-end' : 'flex-start' }}>
        {label}
        {active && (dir === 'asc'
          ? <ArrowUpwardIcon sx={{ fontSize: 13, color: 'primary.main' }} />
          : <ArrowDownwardIcon sx={{ fontSize: 13, color: 'primary.main' }} />)}
      </Box>
    </Box>
  )
}
