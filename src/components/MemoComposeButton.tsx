import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import ChatIcon from '@mui/icons-material/Chat'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { createImprovement, updateImprovement } from '@/api/improve'
import { useRole } from '@/auth/role'
import { memoCountByPath, pathToLocation, memosForPath, visibleMemos, firstLine, matchesPath } from '@/utils/improveMemo'
import { useSnack, focusRingSx } from '@/components/ds'
import { control, iconSize, radius, typescale, weight } from '@/theme/tokens'
import { createPageNote, fetchPageNotes } from '@/api/pageNotes'
import { fetchAuthors } from '@/api/works'
import { MemoKindPicker, MemoKindHint, SharePicker, DEFAULT_MEMO_KIND, PAGE_NOTES_CHANGED, notifyPageNotesChanged } from '@/components/memoKind'
import type { MemoKind } from '@/components/memoKind'

/**
 * 상단바 '메모' 버튼 — 붙임쪽지의 입력 창구.
 *
 * 게시판의 새 요청 폼(유형·긴급·담당자·링크…)이 번거로워 요청이 안 올라오던 문제를 입력 쪽에서 푼 것.
 * 여기서는 제목·내용만 받고, **보고 있던 화면이 곧 개선위치**가 된다(상태는 '접수').
 * 저장되는 곳은 기존 improvements 그대로라 게시판 목록·상태·통계는 하나도 바뀌지 않는다.
 *
 * 등록 직후 memo=true 로 올려 그 화면에 쪽지로 뜨게 한다(StickyMemo). 매핑되는 위치가 없는
 * 경로(기타)면 쪽지 없이 게시판 접수만 되고, 그 사실을 폼에서 미리 알린다.
 */
export default function MemoComposeButton() {
  const { pathname } = useLocation()
  const { isMember, isAdmin, user, authKey } = useRole()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  // 갈래 — 기본은 일반메모(2026-08-06 사용자 지시)
  /**
   * 일반메모는 **PC 전용**이다 — 띄우는 곳이 쪽지 레이어 하나뿐인데 그 레이어가 PC 전용이라
   * (StickyMemoLayer 의 isDesktop 게이트), 모바일에서 만들면 어디에도 안 보이는 메모가 된다.
   * 그래서 모바일에서는 갈래 선택을 감추고 요청메모(게시판이 있어 모바일에서도 볼 수 있다)로 고정한다.
   * 옆의 '화면에 그리기' 버튼이 이미 같은 이유로 모바일에서 숨겨져 있다(TopBar).
   */
  const isDesktop = useMediaQuery((th: Theme) => th.breakpoints.up('shell'))
  const [kind, setKind] = useState<MemoKind>(DEFAULT_MEMO_KIND)
  const [shared, setShared] = useState<string[]>([])
  const [people, setPeople] = useState<string[]>([])
  /** 일반메모 경로 목록 — 버튼 옆 건수에 요청메모와 함께 센다 */
  const [notePaths, setNotePaths] = useState<string[]>([])

  const items = useAppSelector((s) => s.improve.items)
  // 버튼 옆 건수 = 지금 이 화면에 떠 있는 쪽지 수(사이드바 배지·쪽지와 같은 기준 — 내 것 + 관리자는 전체).
  // 2026-08-06 부터 일반메모도 같은 자리에 뜨므로 함께 센다 — 안 그러면 눈앞의 쪽지가 건수에서 빠진다.
  const mine = visibleMemos(items, user, isAdmin)
  // 모바일에서는 일반메모가 화면에 안 뜨므로 세지도 않는다 — 가리킬 대상이 없는 배지는 거짓말이다
  const here = memosForPath(mine, pathname).length + (isDesktop ? notePaths.filter((p) => matchesPath(pathname, p)).length : 0)
  const total = Object.values(memoCountByPath(mine)).reduce((a, b) => a + b, 0) + (isDesktop ? notePaths.length : 0)
  const loc = pathToLocation(pathname)

  /** 일반메모 건수 — RLS 가 '내 것 + 공유받은 것'만 준다. 만들거나 지울 때마다 다시 센다 */
  const countNotes = useCallback(() => {
    void fetchPageNotes().then((rows) => setNotePaths(rows.map((r) => r.path))).catch(() => {})
  }, [])
  useEffect(() => {
    if (!isMember) return
    countNotes()
    window.addEventListener(PAGE_NOTES_CHANGED, countNotes)
    return () => window.removeEventListener(PAGE_NOTES_CHANGED, countNotes)
  }, [isMember, countNotes])

  // 공유 대상 후보는 한 번만 — 사람 목록은 자주 바뀌지 않는다
  useEffect(() => {
    if (!isMember) return
    let alive = true
    void fetchAuthors().then((n) => { if (alive) setPeople(n) }).catch(() => {})
    return () => { alive = false }
  }, [isMember])

  // 쓰기 권한은 게시판(canEdit)과 동일 — 게스트·유관자에게는 버튼 자체를 노출하지 않는다
  if (!isMember || !user || !authKey) return null // 구성원 쓰기 개방(2026-08-05)

  // 닫을 때 갈래·공유 대상을 기본값으로 되돌린다 — 남겨 두면 다음 메모가 앞선 설정을 물려받는다
  const close = () => {
    if (busy) return
    setOpen(false)
    setKind(DEFAULT_MEMO_KIND)
    setShared([])
  }

  const save = async () => {
    const body = content.trim()
    if (!body) return snack('내용을 입력해주세요.', 'error')
    setBusy(true)
    try {
      // 모바일에서 갈래 선택을 감췄어도 state 는 남아 있을 수 있다 — 저장 직전에 한 번 더 막는다
      if (kind === 'plain' && isDesktop) {
        // 일반메모 — 개선요청을 만들지 않는다. 상태도 요청번호도 연동 게시판도 없다.
        // 어느 화면이든 남길 수 있다('기타' 예외 없음 — 게시판이 아니라 pathname 으로 자리를 잡으므로)
        await createPageNote({ path: pathname, content: body, shared })
        setContent('')
        setShared([])
        setKind(DEFAULT_MEMO_KIND)
        setOpen(false)
        snack(shared.length ? `이 화면에 메모를 붙였습니다. ${shared.length}명과 공유합니다.` : '이 화면에 메모를 붙였습니다.', 'success')
        notifyPageNotesChanged()
        return
      }
      const num = await createImprovement({
        author: user, key: authKey, loc: loc || '기타',
        // 담당자 = 작성자. 게시판의 일괄등록(improve_create_batch)도 mgr=my_name()으로 넣는다.
        // 비워두면 삭제 권한자가 없어져 게시판에서 지울 수 없는 글이 된다.
        // 제목 칸은 없앴다(사용자 지시 2026-08-05) — 게시판 제목은 내용 첫 줄에서 만든다.
        title: firstLine(body), content: body, mgr: user,
      })
      // 연결되는 화면이 있을 때만 쪽지로 띄운다('기타'는 띄울 화면이 없다)
      if (loc) await updateImprovement({ author: user, key: authKey, num, memo: true })
      setContent('')
      setShared([])
      setKind(DEFAULT_MEMO_KIND)
      setOpen(false)
      snack(loc ? `이 화면에 메모를 붙였습니다. (요청 #${num})` : `게시판에 접수했습니다. (요청 #${num})`, 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '메모 등록에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* data-memo-anchor = 새 쪽지의 기본 자리 기준점(StickyMemo가 이 버튼 바로 아래에 붙인다) */}
      <Tooltip title={total > 0 ? `화면 메모 — 이 화면 ${here}건 / 전체 ${total}건` : '이 화면에 메모 붙이기'}>
        <ButtonBase
          ref={anchorRef}
          data-memo-anchor=""
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="이 화면에 메모 붙이기"
          /* 상단바 컨트롤은 '테두리 없이 옅은 면으로만 구분'이 정본(바로 옆 통합검색과 같은 처리).
             앰버 채움+앰버 테두리로 두면 상단바에서 혼자 튀고, 무엇보다 그 테두리(amber 50%)가
             배경 대비 라이트 1.44:1 · 다크 2.88:1 로 WCAG 1.4.11(비텍스트 3:1) 미달이라
             라이트에서는 테두리가 보이지도 않았다(2026-08-05 실측). 색은 건수 배지에만 남긴다. */
          sx={(th) => ({
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            height: control.topbar, px: 1.25, flexShrink: 0,
            border: 'none', borderRadius: `${radius.input}px`,
            bgcolor: alpha(th.palette.text.primary, 0.08),
            color: 'text.secondary',
            fontSize: typescale.body.size, fontWeight: weight.bold,
            whiteSpace: 'nowrap',
            transition: 'background-color .14s',
            '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.14) },
            ...(focusRingSx as object),
          })}
        >
          {/* 글자 '메모' 대신 아이콘 — 옆의 '화면에 그리기'와 같은 모양의 한 쌍이 된다
              (사용자 지시 2026-08-06). 건수 배지는 그대로 — 이 화면에 몇 건인지가 이 버튼의 핵심 정보다 */}
          <ChatIcon sx={{ fontSize: iconSize.header }} />
          {here > 0 && (
            <Box
              component="span"
              sx={(th) => ({
                display: 'inline-grid', placeItems: 'center', minWidth: 17, height: 17, px: '4px',
                borderRadius: `${radius.pill}px`, bgcolor: th.palette.accent.amber,
                color: th.palette.getContrastText(th.palette.accent.amber),
                fontSize: typescale.caption.size, fontWeight: weight.heavy, lineHeight: 1,
              })}
            >
              {here}
            </Box>
          )}
        </ButtonBase>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        // 스크롤 잠금을 끄는 이유: MUI 기본값은 body에 padding-right(스크롤바 폭)를 넣어 상단바를
        // 왼쪽으로 밀어낸다. 그 상태에서 새 쪽지의 기본 자리를 재면 버튼 위치가 그만큼 어긋난다.
        // 상단바는 sticky라 스크롤해도 제자리에 있으므로 잠글 이유도 없다.
        disableScrollLock
        slotProps={{ paper: { sx: { mt: 1, width: 340, p: 2, bgcolor: 'background.paper', borderRadius: `${radius.modal}px` } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: typescale.cardTitle.size, fontWeight: weight.heavy, mb: 0.5 }}>
          <ChatIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accentText.amber })} />
          메모 남기기
        </Box>
        {/* 갈래 고르기 — 기본은 일반메모(2026-08-06 사용자 지시로 메모가 둘로 갈렸다).
            모바일에서는 일반메모를 띄울 자리가 없어 선택을 감추고 요청메모로 간다(위 isDesktop 주석) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.5 }}>
          {isDesktop ? (
            <MemoKindPicker value={kind} onChange={setKind} disabled={busy} />
          ) : (
            <Box sx={{ fontSize: typescale.caption.size, color: 'text.secondary' }}>
              일반메모는 PC에서만 쓸 수 있어 <b style={{ color: 'inherit' }}>요청메모</b>로 올립니다.
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlaceOutlinedIcon sx={{ fontSize: iconSize.caption, color: 'text.secondary' }} />
            <MemoKindHint kind={kind} loc={loc} />
          </Box>
        </Box>
        {/* 칸은 하나 — '한 줄 요약'을 없앴다(사용자 지시 2026-08-05).
            게시판 제목은 내용 첫 줄에서 자동으로 만든다(improveMemo.firstLine). */}
        <TextField
          autoFocus fullWidth size="small" multiline minRows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={kind === 'plain' ? '메모 내용' : '무엇이 어떻게 불편한지'}
          slotProps={{ htmlInput: { 'aria-label': '메모 내용' } }}
          disabled={busy}
        />
        {/* 공유는 일반메모만 — 요청메모의 열람 범위는 작성자 + 포털 관리자로 정해져 있다 */}
        {kind === 'plain' && (
          <Box sx={{ mt: 1 }}>
            <SharePicker people={people.filter((p) => p !== user)} value={shared} onChange={setShared} disabled={busy} />
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
          <Button size="small" onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button size="small" variant="contained" onClick={save} disabled={busy || !content.trim()}>
            {busy ? '붙이는 중…' : '붙이기'}
          </Button>
        </Box>
      </Popover>
    </>
  )
}
