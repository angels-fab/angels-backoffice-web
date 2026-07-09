import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { MEMBERS, given } from '@/pages/Calendar/members'
import type { DemoChatMsg } from '@/api/demo'

/** 카드 날짜 — MM.DD (KST 고정, 다른 포매터들과 동일 관례). ko-KR "07. 08." → "07.08" */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const FALLBACK = '#8a8f98'
/** 담당자 색을 밝게 — 어두운 카드 위 제목/칩 글자용 */
const liteC = (c: string) => `color-mix(in srgb, ${c} 55%, #ffffff)`

/**
 * 코멘트 메모 카드 1장 — 네온(어두운 카드 + 담당자 색 테두리, 다크 포탈 동화).
 * 띠 헤더(제목·작성자칩·날짜·본인이면 수정/삭제) + 본문. 발광 효과는 은은하게.
 */
function MemoCard({ m, own, onEdit, onDelete }: { m: DemoChatMsg; own: boolean; onEdit: () => void; onDelete: () => void }) {
  const c = memberOf(m.author)?.color || FALLBACK
  // 제목 도입 전 구버전 글(title='')은 본문을 제목 자리로 올림(빈 띠 방지)
  const title = m.title || m.body
  const body = m.title ? m.body : ''
  return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#1a1d26', color: '#dfe6f2', border: `1px solid ${alpha(c, 0.85)}`, boxShadow: `0 0 5px ${alpha(c, 0.18)}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.09) }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: liteC(c), textShadow: `0 0 3px ${alpha(c, 0.35)}`, wordBreak: 'break-word' }}>{title}</Box>
        <Box component="span" sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 20, px: 1, fontSize: 11, fontWeight: 600, borderRadius: '7px', whiteSpace: 'nowrap', border: `1px solid ${alpha(c, 0.85)}`, color: liteC(c) }}>{m.author || '팀원'}</Box>
        <Box component="span" sx={{ flex: 'none', fontSize: 10.5, fontFamily: 'monospace', color: '#7e8797', opacity: 0.75 }}>{fmtDay(m.createdAt)}</Box>
        {own && (
          <>
            <IconButton size="small" aria-label="코멘트 수정" onClick={onEdit} sx={{ p: '1px', flex: 'none', color: 'rgba(255,255,255,.45)', '&:hover': { color: liteC(c) } }}>
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
            <IconButton size="small" aria-label="코멘트 삭제" onClick={onDelete} sx={{ p: '1px', flex: 'none', color: 'rgba(255,255,255,.45)', '&:hover': { color: '#e05b54' } }}>
              <CloseIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </>
        )}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</Box>}
    </Box>
  )
}

/** 제목+내용 입력 카드(신규 작성·수정 공용) — 전체폭 */
function ComposeCard({ title, body, busy, onTitle, onBody, onCancel, onSave, saveLabel }: {
  title: string; body: string; busy: boolean; onTitle: (v: string) => void; onBody: (v: string) => void; onCancel: () => void; onSave: () => void; saveLabel: string
}) {
  return (
    <Box sx={(th) => ({ gridColumn: '1 / -1', border: `1px solid ${th.palette.primary.main}`, borderRadius: '10px', bgcolor: 'background.paper', p: '8px 10px' })}>
      <InputBase autoFocus value={title} onChange={(e) => onTitle(e.target.value)} placeholder="제목" sx={{ width: '100%', fontSize: 13, fontWeight: 700 }} />
      <InputBase multiline minRows={2} value={body} onChange={(e) => onBody(e.target.value)} placeholder="내용 입력… (선택)"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave() } }}
        sx={{ width: '100%', fontSize: 12 }} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
        <Button size="small" onClick={onCancel} disabled={busy} sx={{ color: 'text.secondary', fontSize: 11.5, minWidth: 0 }}>취소</Button>
        <Button size="small" variant="contained" onClick={onSave} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>{saveLabel}</Button>
      </Box>
    </Box>
  )
}

/**
 * 코멘트 — 비교표 옆/아래, 제목 있는 메모카드 그리드(PC=여러 장, 모바일=1열). 네온 테마 고정.
 * 작성자 색은 담당자 필터 색상과 매치. 본인 카드만 수정·삭제. "코멘트 추가"로 제목+내용 입력.
 */
export default function DemoChat({ memos, canPost, user, busy, onPost, onEdit, onDelete }: {
  memos: DemoChatMsg[]; canPost: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eBody, setEBody] = useState('')

  const save = async () => { if (!title.trim() || busy) return; try { await onPost(title, draft); setTitle(''); setDraft(''); setAdding(false) } catch { /* 입력 유지 */ } }
  const startEdit = (m: DemoChatMsg) => { setAdding(false); setEditId(m.id); setETitle(m.title); setEBody(m.body) }
  const saveEdit = async () => { if (!eTitle.trim() || editId == null || busy) return; try { await onEdit(editId, eTitle, eBody); setEditId(null) } catch { /* 입력 유지 */ } }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.25, alignItems: 'start' }}>
      {memos.map((m) => (
        editId === m.id ? (
          <ComposeCard key={m.id} title={eTitle} body={eBody} busy={busy} saveLabel="수정"
            onTitle={setETitle} onBody={setEBody} onCancel={() => setEditId(null)} onSave={() => void saveEdit()} />
        ) : (
          <MemoCard key={m.id} m={m} own={!!user && m.author === user} onEdit={() => startEdit(m)} onDelete={() => onDelete(m.id)} />
        )
      ))}

      {/* 작성 카드 — 입력 중이면 전체폭(제목+내용), 아니면 한 칸 '+ 코멘트 추가' */}
      {canPost && (adding ? (
        <ComposeCard title={title} body={draft} busy={busy} saveLabel="저장"
          onTitle={setTitle} onBody={setDraft} onCancel={() => { setAdding(false); setTitle(''); setDraft('') }} onSave={() => void save()} />
      ) : (
        <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
          sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 52, border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
          <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
        </Box>
      ))}
      {memos.length === 0 && !adding && !canPost && <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}
    </Box>
  )
}
