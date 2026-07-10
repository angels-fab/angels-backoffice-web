import { RichBodyEditor } from '@/components/richText'

/**
 * 공지 본문 리치텍스트 에디터 — 공용 RichBodyEditor(업무·개선요청·코멘트와 동일 툴바/기능).
 * 출력은 HTML(getHTML). 저장·표시(noticeBodyHTML의 DOMPurify)와 그대로 호환.
 * NoticeCompose가 notice별로 key 리마운트하므로 초기값은 마운트 1회만 사용.
 */

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function NoticeBodyEditor({ value, onChange, placeholder }: Props) {
  return (
    <RichBodyEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder || '내용'}
      ariaLabel="공지 내용"
      fontSize={14}
      minHeight={88}
    />
  )
}
