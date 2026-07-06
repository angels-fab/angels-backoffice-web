import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import type { Notice } from '@/types'
import { noticeBodyHTML } from './noticeMeta'

const refUrl = (n: Notice) => String(n.ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" component="span" sx={{ color: 'text.disabled', flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" component="span" sx={{ color: 'text.primary' }}>{value}</Typography>
    </Box>
  )
}

export interface NoticeDetailProps {
  notice: Notice
  /** 관리자 모드 — 수정/삭제 액션 노출 */
  isAdmin?: boolean
  onEdit?: (notice: Notice) => void
  onDelete?: (notice: Notice) => void
}

/** 공지 상세 — 목록 행 아래 아코디언으로 펼쳐지는 내용(구 NoticeDrawer 대체). */
export default function NoticeDetail({ notice, isAdmin, onEdit, onDelete }: NoticeDetailProps) {
  const url = refUrl(notice)
  const dept = (notice.dept || '').trim()
  const target = (notice.target || '').trim()
  // 내용 왼쪽을 분류열(번호열 폭 뒤) 왼쪽에 정렬 — 번호열 48px + 셀 좌패딩 ≈ 64px 들여쓰기
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: '16px 18px 20px 64px', bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
      {/* 상단: (좌) 부서·해당자 / (우) 수정·삭제 아이콘. 분류칩·작성자·작성일은 제거(제목행에 분류칩 존재) */}
      {(dept || target || isAdmin) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', minWidth: 0 }}>
            {dept && <MetaItem label="부서" value={dept} />}
            {target && <MetaItem label="해당자" value={target} />}
          </Box>
          {isAdmin && (
            <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
              <Tooltip title="수정"><IconButton size="small" aria-label="수정" onClick={() => onEdit?.(notice)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="삭제" onClick={() => onDelete?.(notice)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            </Box>
          )}
        </Box>
      )}

      <Box
        sx={{
          fontSize: 14, lineHeight: 1.7, color: 'text.secondary', borderTop: 1, borderColor: 'divider', pt: 2,
          '& a': { color: 'primary.main' },
          '& img': { maxWidth: '100%', borderRadius: 1 },
          '& p': { m: 0, mb: 1 },
          '& ul, & ol': { pl: 3, m: 0, mb: 1 },
          '& ul': { listStyle: 'disc' },
          '& ol': { listStyle: 'decimal' },
          '& li': { mb: 0.5 },
          '& li p': { m: 0 },
          '& strong, & b': { color: 'text.primary', fontWeight: 700 },
        }}
        dangerouslySetInnerHTML={{ __html: noticeBodyHTML(notice.body) }}
      />

      {url && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
          <Button variant="outlined" size="small" startIcon={<OpenInNewIcon />} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
            관련 자료
          </Button>
        </Box>
      )}
    </Box>
  )
}
