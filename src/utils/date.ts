/** 서울 기준 오늘 날짜 YYYY-MM-DD */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** 시트 날짜 정규화: ISO(UTC) → 한국시간 기준 YYYY-MM-DD */
export function fmtDate(v: string): string {
  v = String(v || '').trim()
  if (!v) return ''
  if (/\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    }
  }
  const m = v.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0')
  return v
}

/** 시작일자 문자열 → Date (ISO 일시·'2026. 6. 8' 등 시트의 다양한 표기 허용) */
export function parseStartDate(s: string): Date | null {
  s = String(s || '').trim()
  if (!s) return null
  if (/\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** 정렬용 타임스탬프 (빈 날짜는 -Infinity → 하단) */
export function dateSortValue(s: string): number {
  const d = parseStartDate(s)
  return d ? d.getTime() : -Infinity
}

export function nowStamp(): string {
  return (
    new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 업데이트'
  )
}
