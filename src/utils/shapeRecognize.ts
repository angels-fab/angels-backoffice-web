import type { MemoStroke, MemoStrokeKind } from '@/api/improve'

/**
 * 손으로 대충 그린 획 → 반듯한 도형 (2026-08-06 신설).
 *
 * 판정은 **손을 뗀 뒤 한 번만** 한다. 그리는 도중 계속 판정하면 선이 계속 튀어 오히려 어지럽다
 * (캡처 도구·OneNote·Excalidraw 모두 같은 방식).
 *
 * 규칙 기반으로 짠 이유: 알아볼 도형이 넷(직선·화살표·사각형·타원)뿐이라 제스처 인식 알고리즘
 * ($1/$P 계열)을 얹는 것보다 규칙이 짧고, 무엇보다 **왜 그렇게 판정했는지 눈으로 확인·조정할 수 있다.**
 * 오인식은 이 기능의 유일한 위험이라 임계값을 보수적으로 잡았다 — 애매하면 null(=손그림 유지)이다.
 */

type Pt = [number, number]

const toPts = (p: number[]): Pt[] => {
  const out: Pt[] = []
  for (let i = 0; i + 1 < p.length; i += 2) out.push([p[i], p[i + 1]])
  return out
}
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const pathLen = (q: Pt[]) => q.reduce((s, p, i) => (i ? s + dist(q[i - 1], p) : 0), 0)

/** 길이를 따라 균등하게 n개로 다시 찍는다 — 점 간격이 들쭉날쭉하면 꺾임 판정이 흔들린다 */
function resample(q: Pt[], n: number): Pt[] {
  const total = pathLen(q)
  if (total === 0) return q.slice(0, 1)
  const step = total / (n - 1)
  const out: Pt[] = [q[0]]
  let acc = 0
  let prev = q[0]
  for (let i = 1; i < q.length; i++) {
    let d = dist(prev, q[i])
    while (acc + d >= step && out.length < n - 1) {
      const t = (step - acc) / d
      prev = [prev[0] + (q[i][0] - prev[0]) * t, prev[1] + (q[i][1] - prev[1]) * t]
      out.push(prev)
      d = dist(prev, q[i])
      acc = 0
    }
    acc += d
    prev = q[i]
  }
  while (out.length < n) out.push(q[q.length - 1])
  return out
}

/**
 * 이웃 점 평균으로 살짝 다듬는다 — 손떨림 때문에 생긴 잔 꺾임을 없앤다.
 * 이게 없으면 곧게 그은 변에서도 꺾임이 잔뜩 잡혀 사각형이 사각형으로 안 읽힌다(실측).
 * 모서리는 여러 점에 걸쳐 크게 도는 변화라 이 정도 평균으로는 뭉개지지 않는다.
 */
function smooth(q: Pt[], passes = 2): Pt[] {
  let cur = q
  for (let n = 0; n < passes; n++) {
    const out: Pt[] = [cur[0]]
    for (let i = 1; i < cur.length - 1; i++) {
      out.push([(cur[i - 1][0] + cur[i][0] + cur[i + 1][0]) / 3, (cur[i - 1][1] + cur[i][1] + cur[i + 1][1]) / 3])
    }
    out.push(cur[cur.length - 1])
    cur = out
  }
  return cur
}

/** 다각형 넓이(신발끈) — 닫힌 도형이 자기 외접 사각형을 얼마나 채우는지 재는 데 쓴다 */
function area(q: Pt[]): number {
  let s = 0
  for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(s) / 2
}

/**
 * 급하게 꺾인 지점 수 — 연속으로 꺾인 구간은 하나로 센다(한 모서리를 두 번 세지 않게).
 *
 * 방향을 **바로 옆 점이 아니라 span 칸 떨어진 점과** 비교한다. 옆 점끼리 재면 손떨림 한 번에
 * 각도가 크게 튀어 곧은 변에서도 꺾임이 잡히고, 반대로 부드럽게 다듬으면 진짜 모서리가 여러 점에
 * 나뉘어 문턱을 못 넘는다(실측: 옆 점 기준 사각형 꺾임 0개). 긴 기준선으로 재면 잡음은 상쇄되고
 * 모서리는 그대로 남는다.
 */
function corners(q: Pt[], degMin: number, span = 3): number {
  let count = 0
  let run = false
  for (let i = span; i < q.length - span; i++) {
    const a1 = Math.atan2(q[i][1] - q[i - span][1], q[i][0] - q[i - span][0])
    const a2 = Math.atan2(q[i + span][1] - q[i][1], q[i + span][0] - q[i][0])
    let d = Math.abs(a2 - a1)
    if (d > Math.PI) d = 2 * Math.PI - d
    const sharp = d > (degMin * Math.PI) / 180
    if (sharp && !run) count++
    run = sharp
  }
  return count
}

/** 첫 점과 끝 점을 잇는 직선에서 얼마나 벗어나지 않는가(1에 가까울수록 곧다) */
const straightness = (q: Pt[]) => {
  const L = pathLen(q)
  return L === 0 ? 0 : dist(q[0], q[q.length - 1]) / L
}

/** 인식하기에 너무 짧은 획 — 점찍기·짧은 표시는 손그림 그대로 둔다 */
const MIN_POINTS = 8
const MIN_LEN = 40
const MIN_DIAG = 24

/**
 * 획 하나를 보고 도형을 알아본다. 못 알아보면 null(= 손그림 그대로).
 * 반환값의 p 는 도형 저장 형식(시작·끝 두 점)이다.
 */
export function recognizeShape(p: number[]): { k: MemoStrokeKind; p: number[] } | null {
  const raw = toPts(p)
  if (raw.length < MIN_POINTS) return null
  const L = pathLen(raw)
  if (L < MIN_LEN) return null

  const xs = raw.map((q) => q[0]), ys = raw.map((q) => q[1])
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys)
  const w = x2 - x1, h = y2 - y1
  if (Math.hypot(w, h) < MIN_DIAG) return null

  const q = smooth(resample(raw, 48), 1)
  const gap = dist(q[0], q[q.length - 1])
  // 닫힘 = 시작·끝이 서로 붙어 있다. 전체 길이 대비로도 보고 크기 대비로도 본다
  const closed = gap < L * 0.22 && gap < Math.max(w, h) * 0.45

  if (closed) {
    if (w < 12 || h < 12) return null
    const fill = area(q) / (w * h)
    const c = corners(q, 50)
    /**
     * 채움률(외접 사각형을 얼마나 채우는가)이 가장 잘 가른다 — 사각형 ≈0.93 · 타원 =π/4(0.785) ·
     * 삼각형 ≈0.5. 꺾임 수는 보조로만 쓴다(시작·끝이 만나는 이음매의 모서리 하나는 안 세어져
     * 사각형이 3으로 잡힌다 — 실측). 0.82 를 경계로 두어 타원의 이론값 0.785 와 여유를 둔다.
     */
    if (fill > 0.82 && c >= 2) return { k: 'rect', p: [x1, y1, x2, y2] }
    if (fill > 0.62 && fill <= 0.82 && c <= 1) return { k: 'ellipse', p: [x1, y1, x2, y2] }
    return null
  }

  // 열린 획 — 곧으면 직선
  if (straightness(q) > 0.93) return { k: 'line', p: [raw[0][0], raw[0][1], raw[raw.length - 1][0], raw[raw.length - 1][1]] }

  /**
   * 화살표 — 곧은 몸통을 긋고 끝에서 되꺾어 화살촉을 그린 한 획.
   * 뒤쪽 45% 안에서 120° 넘게 꺾인 지점을 찾고, 그 앞이 곧으며 꼬리가 몸통보다 훨씬 짧으면 화살표로 본다.
   */
  const start = Math.floor(q.length * 0.55)
  for (let i = start; i < q.length - 2; i++) {
    const a1 = Math.atan2(q[i][1] - q[i - 1][1], q[i][0] - q[i - 1][0])
    const a2 = Math.atan2(q[i + 1][1] - q[i][1], q[i + 1][0] - q[i][0])
    let d = Math.abs(a2 - a1)
    if (d > Math.PI) d = 2 * Math.PI - d
    if (d < (120 * Math.PI) / 180) continue
    const body = q.slice(0, i + 1)
    const tail = q.slice(i)
    if (straightness(body) > 0.9 && pathLen(tail) < pathLen(body) * 0.5) {
      return { k: 'arrow', p: [body[0][0], body[0][1], body[body.length - 1][0], body[body.length - 1][1]] }
    }
  }
  return null
}

/** 인식 결과를 적용한 획 — 색·굵기는 그대로 두고 모양만 바꾼다 */
export function snapStroke(s: MemoStroke): MemoStroke | null {
  const r = recognizeShape(s.p)
  return r ? { ...s, ...r } : null
}
