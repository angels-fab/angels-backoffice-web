import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { MEMBERS, given } from '@/pages/Calendar/members'
import type { DemoChatMsg } from '@/api/demo'

/** 카드 날짜 — MM.DD (KST 고정, 다른 포매터들과 동일 관례). ko-KR "07. 08." → "07.08" */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const FALLBACK = '#8a8f98'

// ── 테마(시험 배포 — 여러 안 비교 후 하나로 고정 예정) ──
export type ChatTheme = 'work' | 'postit' | 'lined' | 'kraft' | 'polaroid' | 'neon' | 'circuit'
const THEME_OPTS: { key: ChatTheme; label: string }[] = [
  { key: 'work', label: '업무카드' },
  { key: 'postit', label: '포스트잇' },
  { key: 'lined', label: '유선노트' },
  { key: 'kraft', label: '크라프트' },
  { key: 'polaroid', label: '폴라로이드' },
  { key: 'neon', label: '네온' },
  { key: 'circuit', label: '회로기판' },
]
const HAND = "'Gaegu', 'Pretendard', sans-serif" // 손글씨(종이 테마 전용)
const ROT = [-0.8, 0.6, -0.4] // 포스트잇·폴라로이드 살짝 기울임(순환)
// 담당자 색 ↔ 종이색 혼합 — 파스텔(카드 바탕)/밴드(띠)/잉크(글자)/라이트(네온 제목)
const pastel = (c: string) => `color-mix(in srgb, ${c} 24%, #fcf8ec)`
const band = (c: string) => `color-mix(in srgb, ${c} 42%, #f4edda)`
const ink = (c: string) => `color-mix(in srgb, ${c} 55%, #241f16)`
const liteC = (c: string) => `color-mix(in srgb, ${c} 55%, #ffffff)`

/** 메모 카드 1장 — 업무카드식 2단(띠 헤더=제목·작성자·날짜 / 본문=내용). 폴라로이드만 역순(내용 위·제목 아래) */
function MemoCard({ m, idx, theme, own, onDelete }: { m: DemoChatMsg; idx: number; theme: ChatTheme; own: boolean; onDelete: () => void }) {
  const c = memberOf(m.author)?.color || FALLBACK
  const rot = `rotate(${ROT[idx % 3]}deg)`
  // 제목 도입 전 구버전 글(title='')은 본문을 제목 자리로 올림(빈 띠 방지)
  const title = m.title || m.body
  const body = m.title ? m.body : ''
  const del = (dark: boolean) => own ? (
    <IconButton size="small" aria-label="코멘트 삭제" onClick={onDelete}
      sx={{ p: '1px', flex: 'none', color: dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.35)', '&:hover': { color: '#e05b54' } }}>
      <CloseIcon sx={{ fontSize: 13 }} />
    </IconButton>
  ) : null
  const chip = (outlined = false) => (
    <Box component="span" sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 20, px: 1, fontSize: 11, fontWeight: 600, borderRadius: '7px', whiteSpace: 'nowrap', fontFamily: 'Pretendard, sans-serif', ...(outlined ? { border: `1px solid ${c}`, color: liteC(c) } : { bgcolor: c, color: '#fff' }) }}>
      {m.author || '팀원'}
    </Box>
  )
  const date = (color: string) => (
    <Box component="span" sx={{ flex: 'none', fontSize: 10.5, fontFamily: 'monospace', color, opacity: 0.75 }}>{fmtDay(m.createdAt)}</Box>
  )
  const bodySx = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } as const

  if (theme === 'work') return (
    // 업무현황 업무카드식 — 담당자 색 은은한 틴트 + 띠 헤더, 깔끔한 기본 폰트(다크 포탈 동화)
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', border: `1px solid ${alpha(c, 0.28)}`, bgcolor: alpha(c, 0.06) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.12), borderBottom: `1px solid ${alpha(c, 0.16)}` }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: 'text.primary', wordBreak: 'break-word' }}>{title}</Box>
        {chip()}{date('text.disabled')}{del(true)}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5, color: 'text.secondary', ...bodySx }}>{body}</Box>}
    </Box>
  )
  if (theme === 'postit') return (
    <Box sx={{ borderRadius: '4px', overflow: 'hidden', transform: rot, bgcolor: pastel(c), color: ink(c), boxShadow: '0 3px 8px rgba(0,0,0,.3)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '5px 10px', bgcolor: band(c) }}>
        <Box sx={{ flex: 1, minWidth: 0, fontFamily: HAND, fontSize: 16, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{title}</Box>
        {chip()}{date('inherit')}{del(false)}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontFamily: HAND, fontSize: 14.5, lineHeight: 1.45, ...bodySx }}>{body}</Box>}
    </Box>
  )
  if (theme === 'lined') return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#fffdf3', color: '#333026', border: '1px solid #ded8c2' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '5px 10px', bgcolor: alpha(c, 0.15), borderBottom: '1px solid #ded8c2' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontFamily: HAND, fontSize: 16, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{title}</Box>
        {chip()}{date('#8d8877')}{del(false)}
      </Box>
      {body && (
        <Box sx={{ m: '6px 10px 10px 8px', pl: '12px', borderLeft: '2px solid rgba(214,69,69,.4)', fontFamily: HAND, fontSize: 14, lineHeight: '22px', background: 'repeating-linear-gradient(180deg, transparent 0 21px, #d9e4ef 21px 22px)', ...bodySx }}>{body}</Box>
      )}
    </Box>
  )
  if (theme === 'kraft') return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#c8a26e', color: '#3e2c15', border: '1.5px dashed rgba(78,56,28,.55)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '5px 10px', bgcolor: '#b78c54' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontFamily: HAND, fontSize: 16, fontWeight: 700, lineHeight: 1.25, wordBreak: 'break-word' }}>{title}</Box>
        {chip()}{date('inherit')}{del(false)}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontFamily: HAND, fontSize: 14.5, lineHeight: 1.45, ...bodySx }}>{body}</Box>}
    </Box>
  )
  if (theme === 'polaroid') return (
    <Box sx={{ bgcolor: '#fdfdfb', border: '1px solid #e3e0d5', borderRadius: '3px', p: '7px 7px 0', transform: rot, boxShadow: '0 3px 10px rgba(0,0,0,.3)' }}>
      <Box sx={{ bgcolor: pastel(c), color: ink(c), p: '10px', minHeight: 58, fontFamily: HAND, fontSize: 14, lineHeight: 1.45, ...bodySx }}>{body || title}</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '7px 2px 9px' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontFamily: HAND, fontSize: 15, fontWeight: 700, color: '#3a372f', lineHeight: 1.2, wordBreak: 'break-word' }}>{body ? title : ''}</Box>
        {chip()}{date('#8d8877')}{del(false)}
      </Box>
    </Box>
  )
  if (theme === 'circuit') return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#0e2c1f', color: '#d7e8dc', border: '1.5px solid #c9a227' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: 'rgba(201,162,39,.14)', borderBottom: '1px solid rgba(201,162,39,.4)' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: '#eddc9a', wordBreak: 'break-word' }}>{title}</Box>
        {chip()}{date('#9fb4a3')}{del(true)}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5, ...bodySx }}>{body}</Box>}
    </Box>
  )
  // neon — 어두운 카드 + 담당자 색 네온 테두리(다크 포탈과 동화)
  return (
    <Box sx={{ borderRadius: '8px', overflow: 'hidden', bgcolor: '#1a1d26', color: '#dfe6f2', border: `1px solid ${c}`, boxShadow: `0 0 10px ${alpha(c, 0.45)}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.1) }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: liteC(c), textShadow: `0 0 7px ${alpha(c, 0.9)}`, wordBreak: 'break-word' }}>{title}</Box>
        {chip(true)}{date('#7e8797')}{del(true)}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5, ...bodySx }}>{body}</Box>}
    </Box>
  )
}

/**
 * 코멘트 — 비교표 아래, 제목 있는 메모카드 그리드(PC=여러 장, 모바일=1열).
 * 테마 7종(업무카드·포스트잇·유선노트·크라프트·폴라로이드·네온·회로기판)을 우상단 칩으로 전환하며 비교(시험 배포).
 * 작성자 색은 담당자 필터 색상과 매치. 본인 카드만 삭제. "코멘트 추가"로 제목+내용 입력.
 */
export default function DemoChat({ memos, canPost, user, busy, onPost, onDelete }: {
  memos: DemoChatMsg[]; canPost: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>; onDelete: (id: number) => void
}) {
  const [theme, setTheme] = useState<ChatTheme>(() => {
    let s: string | null = null
    try { s = localStorage.getItem('demoChat:theme') } catch { /* 스토리지 차단 무시 */ }
    return s === 'work' || s === 'postit' || s === 'lined' || s === 'kraft' || s === 'polaroid' || s === 'neon' || s === 'circuit' ? s : 'work'
  })
  const pickTheme = (t: ChatTheme) => { setTheme(t); try { localStorage.setItem('demoChat:theme', t) } catch { /* 저장 불가 무시 */ } }
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const save = async () => { if (!title.trim() || busy) return; try { await onPost(title, draft); setTitle(''); setDraft(''); setAdding(false) } catch { /* 입력 유지 */ } }

  return (
    <Box>
      {/* 테마 후보 전환 — 비교용 임시 UI, 하나로 결정되면 고정 */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mb: 0.75, flexWrap: 'wrap' }}>
        <Box sx={{ fontSize: 10.5, color: 'text.disabled', mr: 0.25 }}>카드 테마</Box>
        {THEME_OPTS.map((t) => (
          <Box key={t.key} role="button" tabIndex={0} aria-pressed={theme === t.key}
            onClick={() => pickTheme(t.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickTheme(t.key) } }}
            sx={(th) => ({
              px: 0.9, py: 0.25, borderRadius: '999px', fontSize: 11, cursor: 'pointer', border: '1px solid', userSelect: 'none',
              ...(theme === t.key
                ? { borderColor: th.palette.primary.main, color: th.palette.primary.main, bgcolor: alpha(th.palette.primary.main, 0.12), fontWeight: 700 }
                : { borderColor: th.palette.divider, color: 'text.secondary', '&:hover': { borderColor: th.palette.primary.main } }),
            })}>
            {t.label}
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1.25, alignItems: 'start' }}>
        {memos.map((m, i) => (
          <MemoCard key={m.id} m={m} idx={i} theme={theme} own={!!user && m.author === user} onDelete={() => onDelete(m.id)} />
        ))}

        {/* 작성 카드 — 입력 중이면 전체폭(제목+내용), 아니면 한 칸 '+ 코멘트 추가' */}
        {canPost && (adding ? (
          <Box sx={(th) => ({ gridColumn: '1 / -1', border: `1px solid ${th.palette.primary.main}`, borderRadius: '10px', bgcolor: 'background.paper', p: '8px 10px' })}>
            <InputBase autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
              sx={{ width: '100%', fontSize: 13, fontWeight: 700 }} />
            <InputBase multiline minRows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="내용 입력… (선택)"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() } }}
              sx={{ width: '100%', fontSize: 12 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
              <Button size="small" onClick={() => { setAdding(false); setTitle(''); setDraft('') }} disabled={busy} sx={{ color: 'text.secondary', fontSize: 11.5, minWidth: 0 }}>취소</Button>
              <Button size="small" variant="contained" onClick={() => void save()} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>저장</Button>
            </Box>
          </Box>
        ) : (
          <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
            sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 52, border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
            <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
          </Box>
        ))}
        {memos.length === 0 && !adding && !canPost && <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}
      </Box>
    </Box>
  )
}
