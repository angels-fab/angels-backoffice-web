// 모바일에서 데스크톱(PC) 레이아웃 보기 토글.
// 앱의 PC/모바일 분기는 CSS 폭 분기점(max-width:768px)에 의존하고, 모바일은
// <meta viewport>가 레이아웃 폭을 기기 폭으로 잡는다. 이 폭을 고정 데스크톱 폭으로
// 덮어쓰면(=브라우저 '데스크톱 사이트 요청'과 동일 원리) 폰에서도 PC 레이아웃이
// 화면에 맞게 축소되어 보인다. 선택은 localStorage에 저장해 새로고침에도 유지.

const KEY = 'forceDesktop'
const DESKTOP_VP = 'width=1280' // 폭만 지정 → 브라우저가 화면 폭에 맞춰 자동 축소
const MOBILE_VP = 'width=device-width, initial-scale=1'

export function isForceDesktop(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** viewport meta를 실제로 갱신(저장은 하지 않음). */
export function applyViewport(force: boolean): void {
  const meta = document.querySelector('meta[name="viewport"]')
  if (meta) meta.setAttribute('content', force ? DESKTOP_VP : MOBILE_VP)
}

/** 선택을 저장하고 즉시 적용. */
export function setForceDesktop(force: boolean): void {
  try {
    localStorage.setItem(KEY, force ? '1' : '0')
  } catch {
    /* 저장 실패해도 적용은 진행 */
  }
  applyViewport(force)
}

/** 터치/모바일 기기 여부 — 토글 버튼은 이 기기에서만 노출(PC에선 불필요). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const ua = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  return coarse || ua
}
