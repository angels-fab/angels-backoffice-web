import type { CSSProperties } from 'react'
import LinkIcon from '@mui/icons-material/Link'
import { QUICK_LINKS } from '@/constants/links'

const cardStyle: CSSProperties = {
  background: 'var(--ink2)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '28px 12px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  transition: 'transform .15s, box-shadow .15s',
}

export default function Links() {
  return (
    <div className="page active" id="page-바로가기">
      <div className="page-header">
        <div className="page-title"><LinkIcon /> 바로가기</div>
      </div>
      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {QUICK_LINKS.map(l => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={cardStyle}>
            <div
              style={{
                width: 64, height: 64, borderRadius: 16, background: l.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}
            >
              {l.icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{l.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.host}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
