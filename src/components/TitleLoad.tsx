// 페이지 타이틀 옆 로딩/업데이트 시각 표시 (원본 .ttl-load)
export default function TitleLoad({ loading, text }: { loading: boolean; text: string | null }) {
  return (
    <span className="ttl-load">
      {loading ? (
        <>
          <span className="load-spin load-spin-sm" />
          불러오는 중...
        </>
      ) : (
        text || ''
      )}
    </span>
  )
}
