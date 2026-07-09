import UTIF from 'utif'

/**
 * 데모 사진 업로드 전처리.
 * - TIF/TIFF: 브라우저가 <img>로 표시 못 함 → UTIF로 디코드해 JPEG 변환(썸네일·미리보기 보장)
 * - 대용량(수MB~수십MB): 최대 변 1600px로 리사이즈 + JPEG(0.85) 재인코딩 → 보통 수백KB로 축소
 * - 작은 일반 이미지(≤400KB, 비TIF)는 원본 그대로(불필요한 재인코딩 방지)
 * - 변환 실패 시 원본 반환(기존 동작 유지)
 */
const MAX_EDGE = 1600
const JPEG_Q = 0.85
const SKIP_BYTES = 400 * 1024

const isTiff = (f: File) => /\.tiff?$/i.test(f.name) || f.type === 'image/tiff'
/** 사진 추가 대상 판별 — image/* 또는 확장자 tif(타입이 비어오는 브라우저 대비) */
export const isPhotoFile = (f: File) => f.type.startsWith('image/') || /\.tiff?$/i.test(f.name)

async function decodeToCanvas(file: File): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 미지원')
  if (isTiff(file)) {
    const buf = await file.arrayBuffer()
    const ifds = UTIF.decode(buf)
    if (!ifds.length) throw new Error('TIFF 디코드 실패')
    UTIF.decodeImage(buf, ifds[0])
    const rgba = UTIF.toRGBA8(ifds[0])
    const w = ifds[0].width, h = ifds[0].height
    canvas.width = w; canvas.height = h
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0) // 복사(새 버퍼)로 TS ImageData 타입 충족
  } else {
    const bmp = await createImageBitmap(file)
    canvas.width = bmp.width; canvas.height = bmp.height
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
  }
  return canvas
}

function downscale(src: HTMLCanvasElement): HTMLCanvasElement {
  const scale = MAX_EDGE / Math.max(src.width, src.height)
  if (scale >= 1) return src
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(src.width * scale))
  out.height = Math.max(1, Math.round(src.height * scale))
  const ctx = out.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return out
}

export async function prepDemoPhoto(file: File): Promise<File> {
  if (!isTiff(file) && file.size <= SKIP_BYTES) return file
  try {
    const canvas = downscale(await decodeToCanvas(file))
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_Q))
    if (!blob) return file
    const name = file.name.replace(/\.(tiff?|png|bmp|webp|jpe?g|gif|avif)$/i, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
