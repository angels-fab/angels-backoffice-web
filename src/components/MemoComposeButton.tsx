import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { createImprovement, updateImprovement } from '@/api/improve'
import { useRole } from '@/auth/role'
import { memoCountByPath, pathToLocation, memosForPath, visibleMemos, firstLine } from '@/utils/improveMemo'
import { useSnack, focusRingSx } from '@/components/ds'
import { control, iconSize, radius, typescale, weight } from '@/theme/tokens'

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

  const items = useAppSelector((s) => s.improve.items)
  // 버튼 옆 건수 = 지금 이 화면에 떠 있는 쪽지 수(사이드바 배지·쪽지와 같은 기준 — 내 것 + 관리자는 전체)
  const mine = visibleMemos(items, user, isAdmin)
  const here = memosForPath(mine, pathname).length
  const total = Object.values(memoCountByPath(mine)).reduce((a, b) => a + b, 0)
  const loc = pathToLocation(pathname)

  // 쓰기 권한은 게시판(canEdit)과 동일 — 게스트·유관자에게는 버튼 자체를 노출하지 않는다
  if (!isMember || !user || !authKey) return null // 구성원 쓰기 개방(2026-08-05)

  const close = () => { if (!busy) setOpen(false) }

  const save = async () => {
    const body = content.trim()
    if (!body) return snack('내용을 입력해주세요.', 'error')
    setBusy(true)
    try {
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
          <StickyNote2OutlinedIcon sx={{ fontSize: iconSize.header }} />
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
          <StickyNote2OutlinedIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accentText.amber })} />
          메모 남기기
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: typescale.caption.size, color: 'text.secondary', mb: 1.5 }}>
          <PlaceOutlinedIcon sx={{ fontSize: iconSize.caption }} />
          {loc ? (
            <>개선위치 <b style={{ color: 'inherit' }}>{loc}</b> · 상태 <b>접수</b> — 자동</>
          ) : (
            <>이 화면은 연결된 개선위치가 없어 <b>게시판 접수만</b> 됩니다</>
          )}
        </Box>
        {/* 칸은 하나 — '한 줄 요약'을 없앴다(사용자 지시 2026-08-05).
            게시판 제목은 내용 첫 줄에서 자동으로 만든다(improveMemo.firstLine). */}
        <TextField
          autoFocus fullWidth size="small" multiline minRows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="무엇이 어떻게 불편한지"
          slotProps={{ htmlInput: { 'aria-label': '메모 내용' } }}
          disabled={busy}
        />
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
