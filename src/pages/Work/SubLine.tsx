import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { displayBullet } from './workMeta'
import { plainLineToBodyLine, RunSpans, type BodyLine } from './richContent'

/**
 * 업무 내용 한 줄 표시. 글머리기호(-, •, ①, 1. 등)를 분리해, 본문이 줄바꿈되면
 * 기호가 아닌 본문 시작 위치 아래로 들여쓰기(행잉 인덴트)된다.
 * bodyLine(서식 포함)이 주어지면 그대로 렌더, 없으면 line(일반 텍스트)을 파싱한다.
 */
/**
 * 들여쓰기 깊이 → 글자 톤. 본문은 이미 들여쓰기로 구조를 갖고 있는데 모든 단계가 같은 색이라
 * 1차 항목과 3차 항목이 구분되지 않았다. 크기는 그대로 두고 **톤만 한 단씩 낮춰** 위계를 만든다.
 * (크기까지 줄이면 3차가 12px 미만으로 떨어져 읽기 하한을 깬다)
 */
const toneByDepth = (indentPx: number): 'text.primary' | 'text.secondary' | 'text.disabled' =>
  indentPx >= 24 ? 'text.disabled' : indentPx >= 8 ? 'text.secondary' : 'text.primary'

export default function SubLine({ line, bodyLine }: { line?: string; bodyLine?: BodyLine }) {
  const bl = bodyLine ?? plainLineToBodyLine(line ?? '')
  const tone = toneByDepth(bl.indentPx)
  const bodySx = { flex: 1, minWidth: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: tone } as const
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ml: `${bl.indentPx}px`, py: 0.25 }}>
      {bl.marker ? (
        <>
          {/* 기호는 본문보다 한 단 흐리게 — 내용이 먼저 읽히게 */}
          <Typography variant="body2" component="span" sx={{ flexShrink: 0, color: tone === 'text.primary' ? 'text.secondary' : 'text.disabled' }}>{displayBullet(bl.marker)}</Typography>
          <Typography variant="body2" component="span" sx={bodySx}><RunSpans runs={bl.runs} /></Typography>
        </>
      ) : (
        <Typography variant="body2" component="span" sx={bodySx}><RunSpans runs={bl.runs} /></Typography>
      )}
    </Box>
  )
}
