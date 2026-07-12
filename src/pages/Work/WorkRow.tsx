import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { iconSize } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { fmtDate } from '@/utils/date'
import { workCatStyle } from '@/utils/workCat'
import { displayBullet } from './workMeta'
import { workBodyLines, RunSpans, type BodyLine } from './richContent'

// 내용 한 줄(서식 포함) → 기호/본문 분리 + hanging indent (앞 들여쓰기 보존)
function BodyLineRow({ line }: { line: BodyLine }) {
  const style = line.indentPx ? { marginLeft: line.indentPx } : undefined
  return (
    <div className="sub-line" style={style}>
      {line.marker && <span className="sub-mark">{displayBullet(line.marker)}</span>}
      <span className="sub-text"><RunSpans runs={line.runs} /></span>
    </div>
  )
}

// 업무 항목 (표형: 구분 | 내용 | 담당자 | 발의일자 | 링크)
export default function WorkRow({ t }: { t: WorkItem }) {
  const title = String(t.task || '').split(/\r?\n/)[0] || ''
  // 본문: '업무내용서식'이 유효하면 서식 적용, 아니면 일반 텍스트. 시간/장소도 포함.
  const subs = workBodyLines(t)
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
                <BodyLineRow key={i} line={l} />
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
              <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
            </a>
          )}
        </span>
      </div>
    </li>
  )
}
