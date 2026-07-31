import Box from '@mui/material/Box'
import TableCell from '@mui/material/TableCell'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { typescale } from '@/theme/tokens'

export interface DataCellProps {
  /** 모바일 카드에서 값 왼쪽에 붙는 열 이름. 데스크톱에선 숨는다. 대표 셀(title)은 생략. */
  label?: string
  align?: 'left' | 'center' | 'right'
  /** 대표 셀 — 모바일 카드에서 제목처럼 맨 위로 올라간다(mobileTableCardSx 와 짝) */
  title?: boolean
  sx?: SxProps<Theme>
  children: ReactNode
}

/**
 * DataCell — 표 셀 + 모바일 카드용 열 이름.
 *
 * 데스크톱에선 열 이름이 숨겨져 평범한 <TableCell> 과 똑같이 보이고,
 * 모바일(≤shell)에서 mobileTableCardSx 와 함께 "열이름 … 값" 한 줄이 된다.
 *
 * 열 이름을 `::before { content: attr(data-label) }` 로 만들지 않는 이유:
 * emotion 의 content 직렬화 결과를 눈으로 확인하기 전엔 확신할 수 없어서, 실제 <span> 으로 렌더한다.
 */
export default function DataCell({ label, align = 'center', title, sx, children }: DataCellProps) {
  return (
    <TableCell align={align} data-title={title ? '1' : undefined} sx={sx}>
      {label && (
        <Box
          component="span"
          sx={(th) => ({
            display: 'none', flex: 'none', color: 'text.disabled',
            fontWeight: typescale.emphasis.weight, fontSize: typescale.caption.size,
            [th.breakpoints.down('shell')]: { display: 'inline' },
          })}
        >
          {label}
        </Box>
      )}
      {children}
    </TableCell>
  )
}
