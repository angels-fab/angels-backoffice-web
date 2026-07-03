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

// 드래그 토큰(시안 docs/mockups/work-drag-trash.html) — 2배 크기로 그려 0.5 스케일(고정 축소율 50%, 존 접근·진입해도 불변)
export const TOKEN_SIZE = 180
export const TOKEN_SCALE = 0.5

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

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * 카드 → 토큰 모임(모핑) — 드래그 시작 시 원본 카드의 클론이 포인터 위 정사각 토큰
 * 위치·크기로 좁혀지며 사라진다(시안 gatherCard). 복수는 index 스태거로 살짝 겹쳐 모임.
 * fire-and-forget: 실패·백그라운드 탭이어도 안전망 타이머로 반드시 클론 제거.
 */
export function gatherToToken(cardEl: HTMLElement, x: number, y: number, index: number): void {
  if (prefersReducedMotion()) return
  try {
    const r = cardEl.getBoundingClientRect()
    const clone = cardEl.cloneNode(true) as HTMLElement
    clone.setAttribute('aria-hidden', 'true')
    Object.assign(clone.style, {
      position: 'fixed', left: `${r.left}px`, top: `${r.top}px`,
      width: `${r.width}px`, height: `${r.height}px`, margin: '0', minHeight: '0',
      pointerEvents: 'none', zIndex: '1300', transition: 'none', overflow: 'hidden', // 토큰(modal+1)보다 아래 — 시안 레이어링

      transformOrigin: '50% 50%', willChange: 'left, top, width, height, opacity, border-radius',
      filter: 'drop-shadow(0 10px 18px rgba(0,0,0,.32))',
    })
    document.body.appendChild(clone)
    const side = TOKEN_SIZE * TOKEN_SCALE // 토큰 시각 크기
    const off = Math.min(index, 2) * 4
    const duration = 240 + index * 25
    const anim = clone.animate(
      [
        { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, opacity: 0.9, borderRadius: '8px' },
        { offset: 0.72, left: `${x - side / 2 + off}px`, top: `${y - side / 2 + off}px`, width: `${side}px`, height: `${side}px`, opacity: 0.6, borderRadius: '11px' },
        { left: `${x - side / 2 + off}px`, top: `${y - side / 2 + off}px`, width: `${side}px`, height: `${side}px`, opacity: 0, borderRadius: '13px' },
      ],
      { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    )
    let settled = false
    const done = () => { if (settled) return; settled = true; try { clone.remove() } catch { /* noop */ } }
    anim.onfinish = done
    anim.oncancel = done
    anim.finished?.then(done, done)
    window.setTimeout(done, duration + 180)
  } catch { /* noop */ }
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
