/**
 * 업무현황 KPI 드롭존 공용 유틸 — 드래그 상태변경(진행중/보류/완료/Remind).
 * 존 요소는 KpiSection이 data-dropzone 속성으로 렌더하고, 그리드가 포인터 좌표로 히트테스트한다.
 */

/** 메인 목록 뷰 — KPI 버튼이 전환 */
export type WorkView = 'inProgress' | 'hold' | 'check' | 'done' | 'remind'
/** 상태변경 드롭 목적지(Check 목록은 드롭 대상 아님) */
export type DropZone = 'inProgress' | 'hold' | 'done' | 'remind'

/** onStatusDrop 반환 — null=변경 없음(카드 원위치). changedNums=실제 변경 카드, finalize=흡입 후 확정(패치·저장·펄스) */
export type StatusDropResult = null | { changedNums: string[]; finalize: () => void }

const ZONE_PAD = 10 // 존 판정 여유(px)
const APPROACH = 240 // 접근 축소 시작 거리(px)
const SCALE_NEAR = 0.82 // 접근 시 최소 축소
const SCALE_INSIDE = 0.76 // 존 안 축소

export function zoneRects(): { zone: DropZone; el: HTMLElement; rect: DOMRect }[] {
  return [...document.querySelectorAll<HTMLElement>('[data-dropzone]')].map((el) => ({
    zone: el.dataset.dropzone as DropZone,
    el,
    rect: el.getBoundingClientRect(),
  }))
}

/** 포인터가 존(여유 포함) 안에 있으면 해당 존 */
export function zoneAt(x: number, y: number): { zone: DropZone; rect: DOMRect } | null {
  for (const z of zoneRects()) {
    const r = z.rect
    if (x >= r.left - ZONE_PAD && x <= r.right + ZONE_PAD && y >= r.top - ZONE_PAD && y <= r.bottom + ZONE_PAD) {
      return { zone: z.zone, rect: r }
    }
  }
  return null
}

function nearestZoneDistance(x: number, y: number): number {
  let best = Infinity
  for (const z of zoneRects()) {
    const r = z.rect
    const dx = Math.max(r.left - x, 0, x - r.right)
    const dy = Math.max(r.top - y, 0, y - r.bottom)
    const d = Math.hypot(dx, dy)
    if (d < best) best = d
  }
  return best
}

/** 이동 중 카드 축소율 — 접근 전 1, 접근할수록 0.82까지, 존 안 0.76 (transform 전용) */
export function dragScale(x: number, y: number, inside: boolean): number {
  if (inside) return SCALE_INSIDE
  const d = nearestZoneDistance(x, y)
  if (d >= APPROACH) return 1
  return 1 - (1 - d / APPROACH) * (1 - SCALE_NEAR)
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * 흡입 애니메이션 — 드래그 오버레이의 클론을 목적지 중심으로 이동·축소·페이드(WAAPI, 250~320ms).
 * 원본 오버레이는 즉시 언마운트해도 된다. reduced-motion이면 즉시 resolve.
 */
export function suckOverlayInto(src: HTMLElement, zoneRect: DOMRect, startScale: number): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve()
  return new Promise((resolve) => {
    try {
      const rect = src.getBoundingClientRect() // 시각(스케일 반영) 박스
      const w = src.offsetWidth || rect.width
      const h = src.offsetHeight || rect.height
      const cxv = rect.left + rect.width / 2
      const cyv = rect.top + rect.height / 2
      const clone = src.cloneNode(true) as HTMLElement
      clone.setAttribute('aria-hidden', 'true')
      Object.assign(clone.style, {
        position: 'fixed',
        left: `${cxv - w / 2}px`,
        top: `${cyv - h / 2}px`,
        width: `${w}px`,
        height: `${h}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '2000',
        transition: 'none',
        transform: `scale(${startScale})`,
        transformOrigin: '50% 50%',
      })
      document.body.appendChild(clone)
      const tx = zoneRect.left + zoneRect.width / 2 - cxv
      const ty = zoneRect.top + zoneRect.height / 2 - cyv
      const anim = clone.animate(
        [
          { transform: `translate(0px, 0px) scale(${startScale})`, opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.15)`, opacity: 0 },
        ],
        { duration: 300, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' },
      )
      // 데이터 확정이 애니메이션 이벤트에 볼모잡히지 않도록 — 백그라운드 탭 등에서 이벤트가
      // 지연/누락돼도 안전망 타이머로 반드시 resolve(중복 호출은 settled로 1회 보장).
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        try { clone.remove() } catch { /* noop */ }
        resolve()
      }
      anim.onfinish = done
      anim.oncancel = done
      anim.finished?.then(done, done)
      window.setTimeout(done, 300 + 180)
    } catch {
      resolve()
    }
  })
}
