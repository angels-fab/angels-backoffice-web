import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { displayBullet } from './workMeta'
import { plainLineToBodyLine, RunSpans, type BodyLine } from './richContent'

/**
 * 업무 내용 한 줄 표시. 글머리기호(-, •, ①, 1. 등)를 분리해, 본문이 줄바꿈되면
 * 기호가 아닌 본문 시작 위치 아래로 들여쓰기(행잉 인덴트)된다.
 * bodyLine(서식 포함)이 주어지면 그대로 렌더, 없으면 line(일반 텍스트)을 파싱한다.
 */
export default function SubLine({ line, bodyLine }: { line?: string; bodyLine?: BodyLine }) {
  const bl = bodyLine ?? plainLineToBodyLine(line ?? '')
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ml: `${bl.indentPx}px`, py: 0.25 }}>
      {bl.marker ? (
        <>
          <Typography variant="body2" component="span" sx={{ flexShrink: 0, color: 'text.disabled' }}>{displayBullet(bl.marker)}</Typography>
          <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}><RunSpans runs={bl.runs} /></Typography>
        </>
      ) : (
        <Typography variant="body2" component="span" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}><RunSpans runs={bl.runs} /></Typography>
      )}
    </Box>
  )
}
