import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { MEMBERS, given } from '@/pages/Calendar/members'
import { RichBodyEditor } from '@/components/richText'
import { RichBodyView } from '@/utils/richBody'
import type { DemoChatMsg } from '@/api/demo'

/** 카드 날짜 — MM.DD (KST 고정, 다른 포매터들과 동일 관례). ko-KR "07. 08." → "07.08" */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const FALLBACK = '#8a8f98'
/** 담당자 색을 밝게 — 어두운 카드 위 제목/칩 글자용 */
const liteC = (c: string) => `color-mix(in srgb, ${c} 55%, #ffffff)`

/** 네온 카드 껍데기 — 제목 띠(담당자 색) + 얇은 구분선 + 본문. 작성/수정/표시 카드가 동일 포맷 공유 */
function neonSx(c: string) {
  return { borderRadius: '8px', overflow: 'hidden', bgcolor: '#1a1d26', color: '#dfe6f2', border: `1px solid ${alpha(c, 0.85)}`, boxShadow: `0 0 5px ${alpha(c, 0.18)}` } as const
}

/**
 * 코멘트 메모 카드 1장 — 네온(어두운 카드 + 담당자 색 테두리).
 * 더블클릭=수정(본인/관리자) · 드래그=순서 변경(팀원) · N열 버튼=너비 사이클(본인/관리자).
 */
function MemoCard({ m, own, draggable, dragOver, onEdit, onDelete, onWidth, onDragStart, onDragOver, onDrop, onDragEnd }: {
  m: DemoChatMsg; own: boolean; draggable: boolean; dragOver: boolean
  onEdit: () => void; onDelete: () => void; onWidth: (w: number) => void
  onDragStart: () => void; onDragOver: (e: React.DragEvent) => void; onDrop: () => void; onDragEnd: () => void
}) {
  const c = memberOf(m.author)?.color || FALLBACK
  // 제목 도입 전 구버전 글(title='')은 본문을 제목 자리로 올림(빈 띠 방지)
  const title = m.title || m.body
  const body = m.title ? m.body : ''
  const w = Math.min(3, Math.max(1, m.width || 1))
  return (
    <Box
      draggable={draggable}
      onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      onDoubleClick={own ? onEdit : undefined}
      sx={(th) => ({ ...neonSx(c), gridColumn: `span ${w}`, cursor: draggable ? 'grab' : 'default', outline: dragOver ? `2px dashed ${th.palette.primary.main}` : 'none', outlineOffset: '2px' })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.14), borderBottom: body ? `1px solid ${alpha(c, 0.28)}` : 'none' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: liteC(c), textShadow: `0 0 3px ${alpha(c, 0.35)}`, wordBreak: 'break-word' }}>{title}</Box>
        <Box component="span" sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 20, px: 1, fontSize: 11, fontWeight: 600, borderRadius: '7px', whiteSpace: 'nowrap', border: `1px solid ${alpha(c, 0.85)}`, color: liteC(c) }}>{m.author || '팀원'}</Box>
        <Box component="span" sx={{ flex: 'none', fontSize: 10.5, fontFamily: 'monospace', color: '#7e8797', opacity: 0.75 }}>{fmtDay(m.createdAt)}</Box>
        {own && (
          <>
            <Tooltip title="너비 전환 (1→2→3열)">
              <Box role="button" tabIndex={0} aria-label={`카드 너비 ${w}열 — 클릭 시 전환`}
                onClick={() => onWidth(w >= 3 ? 1 : w + 1)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWidth(w >= 3 ? 1 : w + 1) } }}
                sx={{ flex: 'none', fontSize: 9.5, lineHeight: 1, px: '4px', py: '3px', borderRadius: '5px', border: '1px solid rgba(255,255,255,.3)', color: 'rgba(255,255,255,.55)', cursor: 'pointer', userSelect: 'none', '&:hover': { color: liteC(c), borderColor: liteC(c) } }}>
                {w}열
              </Box>
            </Tooltip>
            <IconButton size="small" aria-label="코멘트 수정" onClick={onEdit} sx={{ p: '1px', flex: 'none', color: 'rgba(255,255,255,.45)', '&:hover': { color: liteC(c) } }}>
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
            <IconButton size="small" aria-label="코멘트 삭제" onClick={onDelete} sx={{ p: '1px', flex: 'none', color: 'rgba(255,255,255,.45)', '&:hover': { color: '#e05b54' } }}>
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </>
        )}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5 }}><RichBodyView html={body} /></Box>}
    </Box>
  )
}

/** 작성/수정 카드 — 표시 카드와 동일한 네온 포맷(제목 띠 + 리치 본문 에디터). 그리드 span은 호출부가 지정 */
function ComposeCard({ accent, title, body, busy, span, onTitle, onBody, onCancel, onSave, saveLabel }: {
  accent: string; title: string; body: string; busy: boolean; span: number
  onTitle: (v: string) => void; onBody: (v: string) => void; onCancel: () => void; onSave: () => void; saveLabel: string
}) {
  const c = accent
  return (
    <Box sx={{ ...neonSx(c), gridColumn: `span ${span}` }}>
      {/* 제목 띠 — 표시 카드의 제목 자리에 인풋 */}
      <Box sx={{ p: '5px 10px', bgcolor: alpha(c, 0.14), borderBottom: `1px solid ${alpha(c, 0.28)}` }}>
        <InputBase autoFocus value={title} onChange={(e) => onTitle(e.target.value)} placeholder="제목"
          sx={{ width: '100%', fontSize: 13, fontWeight: 700, color: liteC(c), '& input::placeholder': { color: 'rgba(255,255,255,.45)', opacity: 1 } }} />
      </Box>
      {/* 본문 — 공용 리치 에디터(HTML). 어두운 카드라 글자색만 고정 */}
      <Box sx={{ p: '6px 10px 8px', '& .rb-editor': { color: '#dfe6f2' } }}>
        <RichBodyEditor value={body} onChange={onBody} placeholder="내용 입력… (선택)"
          ariaLabel="코멘트 내용" fontSize={12.5} minHeight={44} onCtrlEnter={onSave} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
          <Button size="small" onClick={onCancel} disabled={busy} sx={{ color: 'rgba(255,255,255,.6)', fontSize: 11.5, minWidth: 0 }}>취소</Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>{saveLabel}</Button>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 코멘트 보드 — 3열 그리드. 카드 너비 1~3열(span, DB width) · 드래그로 순서 변경(팀원) ·
 * 더블클릭/연필=수정(본인·관리자) · 작성 카드는 보드 하단 전폭.
 */
export default function DemoChat({ memos, canPost, canModerate = false, user, busy, onPost, onEdit, onDelete, onReorder, onWidth }: {
  memos: DemoChatMsg[]; canPost: boolean; canModerate?: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
  onReorder: (ids: number[]) => void
  onWidth: (id: number, width: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eBody, setEBody] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const myColor = memberOf(user || '')?.color || FALLBACK

  const save = async () => { if (!title.trim() || busy) return; try { await onPost(title, draft); setTitle(''); setDraft(''); setAdding(false) } catch { /* 입력 유지 */ } }
  const startEdit = (m: DemoChatMsg) => { setAdding(false); setEditId(m.id); setETitle(m.title); setEBody(m.body) }
  const saveEdit = async () => { if (!eTitle.trim() || editId == null || busy) return; try { await onEdit(editId, eTitle, eBody); setEditId(null) } catch { /* 입력 유지 */ } }

  // 드래그 재정렬 — 드롭한 카드 앞에 삽입한 새 id 순서를 통째로 전달(같은 장비 그룹 내)
  const drop = (targetId: number) => {
    if (dragId == null || dragId === targetId) return
    const ids = memos.map((m) => m.id).filter((id) => id !== dragId)
    const at = ids.indexOf(targetId)
    ids.splice(at < 0 ? ids.length : at, 0, dragId)
    onReorder(ids)
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.25, alignItems: 'start' }}>
      {memos.map((m) => (
        editId === m.id ? (
          <ComposeCard key={m.id} accent={memberOf(m.author)?.color || FALLBACK} title={eTitle} body={eBody} busy={busy} saveLabel="수정"
            span={Math.min(3, Math.max(1, m.width || 1))}
            onTitle={setETitle} onBody={setEBody} onCancel={() => setEditId(null)} onSave={() => void saveEdit()} />
        ) : (
          <MemoCard key={m.id} m={m} own={canModerate || (!!user && m.author === user)}
            draggable={canPost && editId == null} dragOver={overId === m.id && dragId !== m.id}
            onEdit={() => startEdit(m)} onDelete={() => onDelete(m.id)} onWidth={(w) => onWidth(m.id, w)}
            onDragStart={() => setDragId(m.id)}
            onDragOver={(e) => { if (dragId != null) { e.preventDefault(); setOverId(m.id) } }}
            onDrop={() => { drop(m.id); setDragId(null); setOverId(null) }}
            onDragEnd={() => { setDragId(null); setOverId(null) }} />
        )
      ))}

      {/* 작성 카드 — 보드 하단 전폭. 저장된 카드는 기본 1열로 들어감 */}
      {canPost && (adding ? (
        <ComposeCard accent={myColor} title={title} body={draft} busy={busy} saveLabel="저장" span={3}
          onTitle={setTitle} onBody={setDraft} onCancel={() => { setAdding(false); setTitle(''); setDraft('') }} onSave={() => void save()} />
      ) : (
        <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
          sx={(th) => ({ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 44, border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
          <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
        </Box>
      ))}
      {memos.length === 0 && !adding && !canPost && <Box sx={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}
    </Box>
  )
}
