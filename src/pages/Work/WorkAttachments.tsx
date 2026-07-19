import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import DownloadIcon from '@mui/icons-material/Download'
import CheckIcon from '@mui/icons-material/Check'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { downloadWorkBlob } from '@/api/works'
import { iconSize, motion, radius, typescale } from '@/theme/tokens'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import { fileTypeRank } from '@/pages/Notice/fileTypeIcons'
import type { NoticeFile } from '@/types'

export interface WorkAttachmentsProps {
  attachments?: NoticeFile[]
  /** card=카드 푸터 트레이(컴팩트) / detail=상세 드로어 */
  variant?: 'card' | 'detail'
}

/**
 * 업무 첨부파일 표시(읽기 전용) — 카드 푸터 트레이·상세 드로어 공용(시안 A, 2026-07-20 확정).
 * 구역 라벨(클립+건수) + 파일칩 그리드. 칩 hover 시 크기 표기가 다운로드 아이콘으로 크로스페이드
 * (고정폭 슬롯 — 레이아웃 시프트 없음), 클릭 시 미세 스케일 피드백, 완료 시 초록 체크 1.2초.
 * 터치 기기(hover 없음)는 다운로드 아이콘 상시 표시. 칩은 <button>이라 카드 드래그·선택에서 자동 제외.
 */
export default function WorkAttachments({ attachments, variant = 'card' }: WorkAttachmentsProps) {
  const list = attachments || []
  // 유형별 정렬(pdf→hwp→docx→xlsx→pptx→txt→image→zip→기타). 같은 유형은 기존 순서 유지(안정정렬)
  const sorted = useMemo(
    () => [...list].sort((a, b) => fileTypeRank(a.type, a.name) - fileTypeRank(b.type, b.name)),
    [list],
  )
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [donePath, setDonePath] = useState<string | null>(null) // 방금 다운로드 완료 — 체크 1.2초
  const [err, setErr] = useState('')
  const doneTimer = useRef<number>()
  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

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
      // 완료 피드백 — 초록 체크 1.2초 후 원상복귀
      setDonePath(a.path)
      window.clearTimeout(doneTimer.current)
      doneTimer.current = window.setTimeout(() => setDonePath(null), 1200)
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
      sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.75 : 1 }}
    >
      {/* 구역 라벨 — 클립 13px + 캡션 + 건수 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AttachFileIcon sx={{ fontSize: iconSize.caption, color: 'text.disabled' }} />
        <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, letterSpacing: '0.04em', color: 'text.disabled' }}>
          첨부파일
        </Box>
        <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>{list.length}</Box>
      </Box>
      {/* 파일칩 그리드 — 반응형 열수 자동, 동일 폭 정렬, 긴 이름 말줄임 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${dense ? 185 : 240}px), 1fr))`, gap: dense ? 0.75 : 0.75 }}>
        {sorted.map((a) => {
          const done = donePath === a.path
          return (
            <Box
              key={a.path}
              component="button"
              type="button"
              aria-label={`${a.name} (${formatBytes(a.size)}) 다운로드`}
              aria-busy={busyPath === a.path}
              title={a.name}
              onClick={() => download(a)}
              sx={(th) => ({
                display: 'flex', alignItems: 'center', gap: 0.75, width: '100%', minWidth: 0, textAlign: 'left',
                pl: 0.9, pr: 1, py: dense ? '5px' : '6px', font: 'inherit',
                borderRadius: `${radius.chip}px`, border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper', cursor: 'pointer',
                transition: `border-color ${motion.base}, background-color ${motion.base}, transform ${motion.fast}`,
                '&:hover': { borderColor: th.palette.primary.main, bgcolor: 'background.elevated' },
                '&:hover .att-size': { opacity: 0 },
                '&:hover .att-dl': { opacity: 1 },
                // 터치 기기(hover 없음) — 크기 정보는 유지한 채 다운로드 아이콘을 나란히 상시 표시
                // (적대 리뷰 반영: 크기를 숨기면 모바일에서 첨부 크기를 알 길이 없음)
                '@media (hover: none)': {
                  '& .att-end': { width: 'auto', gap: 0.5 },
                  '& .att-size': { position: 'static', opacity: 1 },
                  '& .att-dl': { position: 'static', opacity: 1 },
                },
                '&:active': { transform: 'scale(.985)' },
                '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 1 },
              })}
            >
              {busyPath === a.path
                ? <CircularProgress size={dense ? 15 : 16} thickness={5} sx={{ flex: 'none' }} />
                : <AttachmentIcon type={a.type} name={a.name} size={dense ? 18 : 20} />}
              <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: dense ? typescale.small.size : typescale.body.size, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</Box>
              {/* 끝 슬롯 — PC: 고정폭에서 크기↔다운로드 크로스페이드 / 터치: 크기+아이콘 병행 / 완료 직후 초록 체크 */}
              <Box component="span" className="att-end" sx={{ position: 'relative', flex: 'none', width: 44, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {done ? (
                  <Box component="span" sx={(th) => ({ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: th.palette.accent.green })}>
                    <CheckIcon sx={{ fontSize: iconSize.body }} />
                  </Box>
                ) : (
                  <>
                    <Box component="span" className="att-size" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: typescale.caption.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', transition: `opacity ${motion.base}` }}>
                      {formatBytes(a.size)}
                    </Box>
                    <Box component="span" className="att-dl" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: 'primary.main', opacity: 0, transition: `opacity ${motion.base}` }}>
                      <DownloadIcon sx={{ fontSize: iconSize.body }} />
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          )
        })}
      </Box>
      {err && <Box role="alert" sx={{ fontSize: typescale.small.size, color: 'error.main' }}>{err}</Box>}
    </Box>
  )
}
