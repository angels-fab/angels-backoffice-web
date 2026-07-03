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
const APPROACH = 220 // 대상 접근 축소 시작 거리(px)
const FIT_INSET = 12 // 대상 내부 완전 진입 시 상하좌우 여백(px)

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

/** 포인터가 휴지통(드래그 중에만 렌더되는 [data-trashzone]) 위인지 — 있으면 rect */
export function trashAt(x: number, y: number): DOMRect | null {
  const el = document.querySelector<HTMLElement>('[data-trashzone]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  const pad = 8
  return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad ? r : null
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * 드래그 카드 축소율 — 원래 직사각형 비율·크기를 유지하다가, 가장 가까운 대상(KPI 존·휴지통)에
 * 220px 이내로 접근하면 거리 비례(smoothstep 보간)로 부드럽게 축소. 대상 내부에 완전히 들어가면
 * 그 대상 안쪽(상하좌우 12px 여백)에 비율 유지로 맞는 크기. 멀어지면 같은 곡선으로 복원.
 * 고정 scale이 아니라 카드·대상의 실측 크기로 계산(KPI·휴지통 동일 규칙).
 */
export function dragShrinkScale(x: number, y: number, cardW: number, cardH: number): number {
  const rects: DOMRect[] = zoneRects().map((z) => z.rect)
  const trashEl = document.querySelector<HTMLElement>('[data-trashzone]')
  if (trashEl) rects.push(trashEl.getBoundingClientRect())
  let best: { d: number; rect: DOMRect } | null = null
  for (const r of rects) {
    const dx = Math.max(r.left - x, 0, x - r.right)
    const dy = Math.max(r.top - y, 0, y - r.bottom)
    const d = Math.hypot(dx, dy) // 내부면 0
    if (!best || d < best.d) best = { d, rect: r }
  }
  if (!best || best.d >= APPROACH || cardW <= 0 || cardH <= 0) return 1
  const fit = Math.min(
    (best.rect.width - FIT_INSET * 2) / cardW,
    (best.rect.height - FIT_INSET * 2) / cardH,
    1,
  )
  const t = smoothstep(1 - best.d / APPROACH)
  return 1 + (Math.max(fit, 0.05) - 1) * t
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * 지니 흡입 — 오버레이(토큰)의 클론이 목적지 중심으로 이동하며 폭이 점차 좁아지고
 * 투명해지는 지니 형태(clip-path)로 빨려 들어간다(시안 genieInto). 원본은 즉시 숨기고
 * 언마운트해도 된다. flashEl을 주면 목적지가 밝기 플래시로 반응한다.
 * 데이터 확정이 애니메이션 이벤트에 볼모잡히지 않도록 안전망 타이머로 반드시 resolve.
 */
export function genieOverlayInto(src: HTMLElement, zoneRect: DOMRect, flashEl?: Element | null): Promise<void> {
  const hideSrc = () => { try { src.style.visibility = 'hidden' } catch { /* noop */ } }
  if (prefersReducedMotion()) { hideSrc(); return Promise.resolve() }
  return new Promise((resolve) => {
    try {
      const rect = src.getBoundingClientRect() // 시각(스케일 반영) 박스
      const w = src.offsetWidth || rect.width
      const h = src.offsetHeight || rect.height
      const s = w > 0 ? rect.width / w : 1 // 현재 시각 스케일(토큰=0.5)
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const clone = src.cloneNode(true) as HTMLElement
      clone.setAttribute('aria-hidden', 'true')
      Object.assign(clone.style, {
        position: 'fixed', left: `${cx - w / 2}px`, top: `${cy - h / 2}px`,
        width: `${w}px`, height: `${h}px`, margin: '0', pointerEvents: 'none',
        zIndex: '2000', transition: 'none', animation: 'none', opacity: '0.96',
        transform: `scale(${s})`, transformOrigin: '50% 50%',
        willChange: 'transform, opacity, clip-path',
      })
      document.body.appendChild(clone)
      hideSrc()
      const tx = zoneRect.left + zoneRect.width / 2 - cx
      const ty = zoneRect.top + zoneRect.height / 2 - cy
      const upward = ty < 0 // 목적지가 위쪽(KPI 존)인지 아래쪽(휴지통)인지에 따라 좁아지는 방향 결정
      const wide = upward ? 'polygon(42% 0,58% 0,100% 100%,0 100%)' : 'polygon(0 0,100% 0,58% 100%,42% 100%)'
      const narrow = upward ? 'polygon(48% 0,52% 0,72% 100%,28% 100%)' : 'polygon(28% 0,72% 0,52% 100%,48% 100%)'
      const full = 'polygon(0 0,100% 0,100% 100%,0 100%)'
      const DUR = 470
      const anim = clone.animate(
        [
          { transform: `translate(0px, 0px) scale(${s})`, clipPath: full, opacity: 0.96 },
          { offset: 0.48, transform: `translate(${tx * 0.5}px, ${ty * 0.45}px) scale(${s * 0.84}, ${s})`, clipPath: wide, opacity: 0.92 },
          { offset: 0.78, transform: `translate(${tx * 0.82}px, ${ty * 0.8}px) scale(${s * 0.36}, ${s * 0.64})`, clipPath: narrow, opacity: 0.72 },
          { transform: `translate(${tx}px, ${ty}px) scale(${s * 0.05}, ${s * 0.2})`, clipPath: narrow, opacity: 0 },
        ],
        { duration: DUR, easing: 'cubic-bezier(.45,0,.7,.25)', fill: 'forwards' },
      )
      try {
        flashEl?.animate?.(
          [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }],
          { duration: DUR, easing: 'ease-out' },
        )
      } catch { /* noop */ }
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
      window.setTimeout(done, DUR + 180)
    } catch {
      hideSrc()
      resolve()
    }
  })
}
