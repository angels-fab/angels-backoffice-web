import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Alert, { type AlertColor } from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'

/**
 * 전역 스낵바 (P2, B#7) — 페이지마다 복제되던 {open,msg,severity} 보일러플레이트와
 * prop drilling(showSnack)을 훅 하나로 수렴한다.
 *
 * 규격(기존 10곳의 암묵 표준을 명문화): bottom-center · Alert variant="filled" ·
 * autoHide 3000ms(재시도 안내 등 오래 보여야 하면 duration 지정) · 마지막 호출이 이김.
 *
 * 사용:
 *   const snack = useSnack()
 *   snack('저장했습니다')                  // 기본 success
 *   snack('저장 실패 — 네트워크 확인', 'error')
 *   snack('오래 보여줄 안내', 'info', 8000)
 */
type ShowSnack = (msg: string, severity?: AlertColor, duration?: number) => void

const SnackCtx = createContext<ShowSnack>(() => {})

export function useSnack(): ShowSnack {
  return useContext(SnackCtx)
}

export function SnackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; msg: string; severity: AlertColor; duration: number }>({
    open: false,
    msg: '',
    severity: 'success',
    duration: 3000,
  })

  const show = useCallback<ShowSnack>((msg, severity = 'success', duration = 3000) => {
    setState({ open: true, msg, severity, duration })
  }, [])

  const handleClose = useCallback((_e?: unknown, reason?: string) => {
    if (reason === 'clickaway') return
    setState((s) => ({ ...s, open: false }))
  }, [])

  const ctx = useMemo(() => show, [show])

  return (
    <SnackCtx.Provider value={ctx}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={state.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={state.severity} variant="filled" sx={{ width: '100%' }} onClose={handleClose}>
          {state.msg}
        </Alert>
      </Snackbar>
    </SnackCtx.Provider>
  )
}
