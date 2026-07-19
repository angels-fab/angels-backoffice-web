import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import DownloadIcon from '@mui/icons-material/Download'
import { downloadWorkBlob } from '@/api/works'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import { fileTypeRank } from '@/pages/Notice/fileTypeIcons'
import type { NoticeFile } from '@/types'

export interface WorkAttachmentsProps {
  attachments?: NoticeFile[]
  /** card=카드 앞면(컴팩트, 헤더 없음) / detail=상세 드로어(헤더 라벨) */
  variant?: 'card' | 'detail'
}

/**
 * 업무 첨부파일 표시(읽기 전용) — 카드 앞면·상세 드로어 공용.
 * 칩 클릭 시 원본 Blob 다운로드(앵커 download로 한글 파일명 보존). 공지 첨부와 동일 톤·아이콘.
 * 각 칩은 <button>이라 업무카드 그리드의 드래그·선택 판정에서 자동 제외된다(button/a 가드).
 */
export default function WorkAttachments({ attachments, variant = 'card' }: WorkAttachmentsProps) {
  const list = attachments || []
  // 유형별 정렬(pdf→hwp→docx→xlsx→pptx→txt→image→zip→기타). 같은 유형은 기존 순서 유지(안정정렬)
  const sorted = useMemo(
    () => [...list].sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name)),
    [list],
  )
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [err, setErr] = useState('')

  if (list.length === 0) return null

  // 원본 Blob을 받아 앵커 download로 저장(서명URL은 한글을 퍼센트 인코딩해 파일명이 깨져 blob 방식)
  const download = async (a: NoticeFile) => {
    if (busyPath) return
    setErr(''); setBusyPath(a.path)
    try {
      const blob = await downloadWorkBlob(a.path)
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url; el.download = a.name || 'file'
      document.body.appendChild(el); el.click(); el.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '다운로드에 실패했습니다')
    } finally {
      setBusyPath(null)
    }
  }

  const dense = variant === 'card'

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.5 : 1 }}
    >
      {variant === 'detail' && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: typescale.cardTitle.weight, letterSpacing: '0.04em' }}>
          첨부파일 {list.length}
        </Typography>
      )}
      {/* 반응형 그리드 — 카드 폭/모바일에 따라 열 수 자동, 각 셀 동일 폭 정렬. 긴 이름은 말줄임 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${dense ? 190 : 240}px), 1fr))`, gap: dense ? 0.5 : 0.75 }}>
        {sorted.map((a) => (
          <Box
            key={a.path}
            component="button"
            type="button"
            aria-label={`${a.name} 다운로드`}
            title={a.name}
            onClick={() => download(a)}
            sx={(th) => ({
              display: 'flex', alignItems: 'center', gap: 0.6, width: '100%', minWidth: 0, textAlign: 'left',
              pl: 0.9, pr: 1, py: dense ? '5px' : '6px', font: 'inherit',
              borderRadius: `${radius.chip}px`, border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper', cursor: 'pointer',
              transition: 'border-color .15s, background-color .15s',
              '&:hover': { borderColor: th.palette.primary.main, bgcolor: 'action.hover' },
              '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
            })}
          >
            {busyPath === a.path
              ? <CircularProgress size={dense ? 15 : 16} thickness={5} sx={{ flex: 'none' }} />
              : <AttachmentIcon type={a.type} name={a.name} size={dense ? 18 : 20} />}
            <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: dense ? typescale.small.size : typescale.body.size, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Box>
            <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(a.size)}</Box>
            <DownloadIcon sx={{ fontSize: iconSize.body, color: 'text.disabled', flex: 'none' }} />
          </Box>
        ))}
      </Box>
      {err && <Box sx={{ fontSize: typescale.small.size, color: 'error.main' }}>{err}</Box>}
    </Box>
  )
}
