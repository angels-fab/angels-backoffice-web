import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ThemeProvider } from '@mui/material/styles'
import { getTheme } from './theme'

/**
 * 라이트/다크 테마 모드 — 단일 상태 소스.
 *
 * - MUI 컴포넌트: 아래 ThemeProvider가 getTheme(mode)로 팔레트를 공급(자동 전환).
 * - 레거시 CSS 페이지: <html data-theme="light|dark"> 속성으로 index.css의
 *   :root 변수 오버라이드를 켠다(useEffect에서 attribute 세팅).
 * - 저장: localStorage 'angels-theme'. 기본값은 다크(사용자 확정 — 기존과 동일).
 *   초기 깜빡임(FOUC) 방지용 attribute 선세팅은 index.html <head> 인라인 스크립트가 담당.
 */

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'angels-theme'

function readInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* localStorage 접근 불가(사생활 모드 등) — 기본값 사용 */
  }
  return 'dark'
}

interface ThemeModeCtx {
  mode: ThemeMode
  toggle: () => void
  setMode: (m: ThemeMode) => void
}

const Ctx = createContext<ThemeModeCtx>({ mode: 'dark', toggle: () => {}, setMode: () => {} })

/** 현재 테마 모드와 전환 함수. 어느 컴포넌트에서나 사용. */
export function useThemeMode(): ThemeModeCtx {
  return useContext(Ctx)
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode)

  // 저장 + <html data-theme> 동기화(초기 마운트·폴백용). 전환 애니메이션 자체는 applyMode가 담당.
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* 저장 실패는 무시(이번 세션만 유지) */
    }
  }, [mode])

  // 테마 적용 — 화면 전체를 한 장의 스냅샷으로 크로스페이드(View Transitions API).
  // 컴포넌트가 각자 따로 전환되지 않고 화면 전체가 한 번에 부드럽게 넘어간다. 셀이 많은 캘린더도
  // GPU 합성 1장이라 버벅이지 않음. 미지원 브라우저·모션 감소 설정에선 즉시 전환.
  const applyMode = useCallback((next: ThemeMode) => {
    const root = document.documentElement
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const startVT = (document as unknown as { startViewTransition?: (cb: () => void) => unknown }).startViewTransition
    const commit = () => {
      // MUI(emotion) 리렌더와 레거시 CSS 변수 전환을 같은 프레임에 커밋 → 스냅샷에 함께 담겨 통짜로 전환
      flushSync(() => setMode(next))
      root.dataset.theme = next
    }
    if (typeof startVT === 'function' && !reduce) {
      // 전환이 거부될 수 있다 — 문서가 아주 길면(업무 보드 완료 열처럼) 루트 스냅샷이 GPU 텍스처
      // 한계를 넘어 "InvalidStateError: Transition was aborted because of invalid state"로 중단되고,
      // 이때 **업데이트 콜백이 아예 실행되지 않아** 테마가 안 바뀐다(실측: 보드 뷰에서 토글 무반응).
      // 전환은 연출일 뿐이므로, 거부되면 즉시 커밋으로 반드시 반영한다(commit은 중복 호출해도 무해).
      let vt: { ready?: Promise<unknown> } | undefined
      try {
        vt = startVT.call(document, commit) as { ready?: Promise<unknown> }
      } catch {
        commit()
        return
      }
      vt?.ready?.catch(() => commit())
    } else {
      commit()
    }
  }, [])

  const value = useMemo<ThemeModeCtx>(
    () => ({
      mode,
      setMode: applyMode,
      toggle: () => applyMode(mode === 'dark' ? 'light' : 'dark'),
    }),
    [mode, applyMode],
  )

  const theme = useMemo(() => getTheme(mode), [mode])

  return (
    <Ctx.Provider value={value}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </Ctx.Provider>
  )
}
