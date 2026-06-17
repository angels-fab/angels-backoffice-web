import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * 업무 내용 한 줄 표시. 글머리기호(-, •, ①, 1. 등)를 분리해, 본문이 줄바꿈되면
 * 기호가 아닌 본문 시작 위치 아래로 들여쓰기(행잉 인덴트)된다.
 */
export default function SubLine({ line }: { line: string }) {
  const lead = line.match(/^[ \t]*/)?.[0] || ''
  const indentPx = lead.replace(/\t/g, '    ').length * 4
  const body = line.slice(lead.length)
  const m = body.match(/^([-–—•*▪◦·●○]|[①-⑳]|\d+[.)]|[가-힣][.)])\s*([\s\S]*)$/)
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ml: `${indentPx}px`, py: 0.25 }}>
      {m ? (
        <>
          <Typography variant="body2" component="span" sx={{ flexShrink: 0, color: 'text.disabled' }}>{m[1]}</Typography>
          <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{m[2]}</Typography>
        </>
      ) : (
        <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{body}</Typography>
      )}
    </Box>
  )
}
