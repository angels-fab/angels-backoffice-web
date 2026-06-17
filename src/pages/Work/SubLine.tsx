import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { mgrColor } from './workMeta'

// 본문 텍스트에서 담당자 이름을 찾아 지정 색으로 칠한다(이름만). names 없으면 평문.
function highlight(text: string, names?: string[]): ReactNode {
  const list = [...new Set((names || []).filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!list.length) return text
  const esc = list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${esc.join('|')})`, 'g')
  const set = new Set(list)
  return text.split(re).map((part, i) =>
    set.has(part)
      ? <Box key={i} component="span" sx={{ color: mgrColor(part), fontWeight: 700 }}>{part}</Box>
      : part,
  )
}

/**
 * 업무 내용 한 줄 표시. 글머리기호(-, •, ①, 1. 등)를 분리해, 본문이 줄바꿈되면
 * 기호가 아닌 본문 시작 위치 아래로 들여쓰기(행잉 인덴트)된다.
 * names가 주어지면 본문 속 해당 담당자 이름을 색으로 표시.
 */
export default function SubLine({ line, names }: { line: string; names?: string[] }) {
  const lead = line.match(/^[ \t]*/)?.[0] || ''
  const indentPx = lead.replace(/\t/g, '    ').length * 4
  const body = line.slice(lead.length)
  const m = body.match(/^([-–—•*▪◦·●○]|[①-⑳]|\d+[.)]|[가-힣][.)])\s*([\s\S]*)$/)
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ml: `${indentPx}px`, py: 0.25 }}>
      {m ? (
        <>
          <Typography variant="body2" component="span" sx={{ flexShrink: 0, color: 'text.disabled' }}>{m[1]}</Typography>
          <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{highlight(m[2], names)}</Typography>
        </>
      ) : (
        <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{highlight(body, names)}</Typography>
      )}
    </Box>
  )
}
