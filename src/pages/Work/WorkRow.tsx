import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { WorkItem } from '@/types'
import { fmtDate } from '@/utils/date'
import { workCatStyle } from '@/utils/workCat'

// 내용 한 줄 → 기호/본문 분리 + hanging indent (앞 들여쓰기 보존)
function SubLine({ line }: { line: string }) {
  const lead = String(line).match(/^[ \t]*/)?.[0] || ''
  const indentPx = lead.replace(/\t/g, '    ').length * 4
  const body = String(line).slice(lead.length)
  const style = indentPx ? { marginLeft: indentPx } : undefined
  const m = body.match(/^([-–—•*▪◦·●○]|[①-⑳]|\d+[.)]|[가-힣][.)])\s*([\s\S]*)$/)
  if (m) {
    return (
      <div className="sub-line" style={style}>
        <span className="sub-mark">{m[1]}</span>
        <span className="sub-text">{m[2]}</span>
      </div>
    )
  }
  return (
    <div className="sub-line" style={style}>
      <span className="sub-text">{body}</span>
    </div>
  )
}

// 업무 항목 (표형: 구분 | 내용 | 담당자 | 발의일자 | 링크)
export default function WorkRow({ t }: { t: WorkItem }) {
  const lines = String(t.task || '').split(/\r?\n/)
  const title = lines[0] || ''
  const subs = lines
    .slice(1)
    .map(l => l.replace(/\s+$/, ''))
    .filter(l => l.trim())
  // G(시간)·H(장소)가 있으면 내용 마지막 줄에 dash로 추가
  if (t.time || t.loc) {
    const parts: string[] = []
    if (t.time) parts.push('시간: ' + t.time)
    if (t.loc) parts.push('장소: ' + t.loc)
    subs.push('- ' + parts.join(' | '))
  }
  // L열 링크가 URL이면 표 우측에 외부 링크 아이콘(새 창)
  const linkUrl = String(t.link || '').match(/https?:\/\/[^\s]+/)

  return (
    <li className="task-item-wrap">
      <div className="cur-row">
        <span className="cur-c-cat">
          {t.cat && (
            <span className="task-cat" style={workCatStyle(t.cat)}>
              {t.cat}
            </span>
          )}
        </span>
        <div className="cur-c-body">
          <div className="cur-title-row">
            <span className="task-name">{title}</span>
            {t.dept && <span className="cur-dept">({t.dept})</span>}
            {t.num && (
              <>
                <span className="cur-leader">{'.'.repeat(120)}</span>
                <span className="task-no-ref">{t.num}</span>
              </>
            )}
          </div>
          {subs.length > 0 && (
            <div className="cur-subs">
              {subs.map((l, i) => (
                <SubLine key={i} line={l} />
              ))}
            </div>
          )}
        </div>
        <span className="cur-c-mgr">{t.mgr || ''}</span>
        <span className="cur-c-date">{fmtDate(t.start)}</span>
        <span className="cur-c-att">
          {linkUrl && (
            <a
              className="cur-att"
              href={linkUrl[0]}
              target="_blank"
              rel="noopener noreferrer"
              title="링크 열기"
              onClick={e => e.stopPropagation()}
            >
              <OpenInNewIcon sx={{ fontSize: 19 }} />
            </a>
          )}
        </span>
      </div>
    </li>
  )
}
