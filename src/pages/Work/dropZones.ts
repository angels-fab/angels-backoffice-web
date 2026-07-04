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

const ZONE_PAD = 10 // 존 판정 여유(px, 클릭·포인터 보조용)
const FIT_INSET = 12 // KPI 내부 완전 진입 시 상하좌우 여백(px)
const TRASH_PAD = 16 // 휴지통 탭 실제 드롭 판정 확장(px)
const ZONE_SWITCH_RATIO = 1.15 // 존 전환 히스테리시스 — 새 존 교차면적이 이만큼 커야 전환

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

export interface CardRect { left: number; top: number; right: number; bottom: number; width: number; height: number }

const intersectArea = (a: CardRect, b: DOMRect, pad = 0): number => {
  const w = Math.min(a.right, b.right + pad) - Math.max(a.left, b.left - pad)
  const h = Math.min(a.bottom, b.bottom + pad) - Math.max(a.top, b.top - pad)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * 카드 실영역이 휴지통 탭([data-trashzone])의 드롭 판정영역(상하좌우 +16px)과 접촉했는지.
 * 포인터 위치는 사용하지 않는다. 접촉 시 탭 rect 반환(축소 fit·흡입 목적지 계산용).
 */
export function trashHitByCard(card: CardRect): DOMRect | null {
  const el = document.querySelector<HTMLElement>('[data-trashzone]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return intersectArea(card, r, TRASH_PAD) > 0 ? r : null
}

/**
 * 카드 실영역 기준 대상 KPI 존 — 각 존과의 실제 교차면적이 가장 큰 존.
 * 두 존 경계에 걸치면 면적이 큰 쪽. 현재 존이 있으면 새 존 면적이 15% 이상 커야 전환(왕복 방지).
 */
export function zoneByCardRect(card: CardRect, current: DropZone | null): { zone: DropZone; rect: DOMRect } | null {
  let best: { zone: DropZone; rect: DOMRect; area: number } | null = null
  let cur: { zone: DropZone; rect: DOMRect; area: number } | null = null
  for (const z of zoneRects()) {
    const area = intersectArea(card, z.rect)
    if (area <= 0) continue
    if (!best || area > best.area) best = { zone: z.zone, rect: z.rect, area }
    if (z.zone === current) cur = { zone: z.zone, rect: z.rect, area }
  }
  if (!best) return null
  if (cur && best.zone !== current && best.area < cur.area * ZONE_SWITCH_RATIO) {
    return { zone: cur.zone, rect: cur.rect } // 히스테리시스 — 명확히 커질 때만 전환
  }
  return { zone: best.zone, rect: best.rect }
}

/**
 * KPI 접근 축소율 — 포인터가 아니라 '이동 카드의 실제 영역' 기준.
 * 카드 상단이 KPI 스트립 하단에 맞닿는 순간부터 시작해, 스트립 안으로 깊이 들어갈수록
 * 해당 존 안쪽(여백 12px)에 비율 유지로 맞는 크기까지 smoothstep으로 축소.
 * 빠져나오면 같은 곡선으로 복원. 진행도 = 침투 깊이 / 스트립 높이.
 */
export function kpiShrinkByCard(card: CardRect, zoneRect: DOMRect): number {
  // 스트립 세로 범위 = 존들의 최소 top ~ 최대 bottom (연결형 스트립이라 사실상 동일)
  let top = Infinity, bottom = -Infinity
  for (const z of zoneRects()) { top = Math.min(top, z.rect.top); bottom = Math.max(bottom, z.rect.bottom) }
  if (!isFinite(top)) return 1
  const penetration = bottom - card.top // 카드 상단이 스트립 하단에 닿기 전 ≤ 0
  if (penetration <= 0) return 1
  const travel = Math.max(1, bottom - top)
  const t = smoothstep(Math.min(1, penetration / travel))
  const fit = fitScaleInto(zoneRect, card.width, card.height)
  return 1 + (fit - 1) * t
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** 대상 rect 안쪽(상하좌우 12px 여백)에 비율 유지로 맞는 축소율 — 실측 크기 계산 */
export function fitScaleInto(rect: DOMRect, cardW: number, cardH: number): number {
  if (cardW <= 0 || cardH <= 0) return 1
  return Math.max(
    Math.min((rect.width - FIT_INSET * 2) / cardW, (rect.height - FIT_INSET * 2) / cardH, 1),
    0.05,
  )
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
