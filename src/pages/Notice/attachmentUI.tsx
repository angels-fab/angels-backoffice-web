import { FileTypeIcon } from './fileTypeIcons'

/** 바이트 → 읽기 쉬운 크기(KB·MB). 1KB 미만은 B 표기 */
export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** 파일명 → 대문자 확장자 라벨(예: 'PDF', 'XLSX'). 없으면 빈 문자열 */
export function fileExtLabel(name: string): string {
  const i = (name || '').lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase() : ''
}

/** 첨부 아이콘 — 파일 유형별 실제 vscode-icons(내장) 렌더. size(px)로 크기 지정 */
export function AttachmentIcon({ type, name, size = 18 }: { type?: string; name?: string; size?: number }) {
  return <FileTypeIcon type={type} name={name} size={size} />
}
