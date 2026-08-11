import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PublicIcon from '@mui/icons-material/Public'
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { mergeSx } from '@/components/ds/sxMerge'
import { iconSize, radius, shadow, typescale, weight } from '@/theme/tokens'

/**
 * 업무카드의 관련링크 아이콘 + 호버 미리보기(개선요청 #67).
 *
 * ★ 미리보기는 **바깥에 아무것도 물어보지 않는다**. 대상 페이지의 제목·대표이미지는 CORS 때문에
 *   브라우저가 읽을 수 없고(상대 서버가 허용 헤더를 주지 않는다), iframe 으로 끼워 넣는 것도
 *   대부분 X-Frame-Options 로 막힌다. 그래서 **주소 문자열에서 확실히 뽑히는 것만** 보여준다 —
 *   서비스 종류·도메인·주소 전문. 사내망이든 권한 없는 링크든 결과가 늘 같다.
 *
 * 아이콘과 미리보기가 한 몸이라, 카드 안 어디로 옮겨도 미리보기가 따라온다.
 */
interface LinkInfo {
  /** 서비스 이름 추정 — 모르면 도메인을 그대로 쓴다 */
  label: string
  icon: ReactNode
  host: string
  /** 사람이 읽을 수 있게 푼 주소 전문 */
  url: string
}

/** 도메인+경로로 서비스 추정. 짚이는 게 없으면 도메인을 이름 삼고 지구본. */
function kindOf(path: string, host: string): Pick<LinkInfo, 'label' | 'icon'> {
  if (host === 'docs.google.com') {
    if (path.startsWith('/spreadsheets')) return { label: '구글 스프레드시트', icon: <TableChartOutlinedIcon /> }
    if (path.startsWith('/presentation')) return { label: '구글 슬라이드', icon: <DescriptionOutlinedIcon /> }
    if (path.startsWith('/forms')) return { label: '구글 설문', icon: <DescriptionOutlinedIcon /> }
    return { label: '구글 문서', icon: <DescriptionOutlinedIcon /> }
  }
  if (host === 'drive.google.com') return { label: '구글 드라이브', icon: <CloudOutlinedIcon /> }
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) return { label: 'Dropbox', icon: <CloudOutlinedIcon /> }
  if (host.endsWith('sharepoint.com') || host === 'onedrive.live.com') return { label: 'OneDrive', icon: <CloudOutlinedIcon /> }
  if (/\.pdf$/i.test(path)) return { label: 'PDF 문서', icon: <PictureAsPdfOutlinedIcon /> }
  return { label: host, icon: <PublicIcon /> }
}

export function linkInfo(raw: string): LinkInfo | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null // 주소로 안 읽히면 원문만 보여준다
  }
  const host = u.hostname.replace(/^www\./, '')
  // decodeURIComponent 가 아니라 decodeURI — 예약문자(%26 등)까지 풀면 주소가 거짓말이 된다
  let url = raw
  try { url = decodeURI(raw) } catch { /* 잘못 인코딩된 주소는 원문 그대로 */ }
  return { ...kindOf(u.pathname, host), host, url }
}

function PreviewBody({ info }: { info: LinkInfo }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, color: 'text.secondary', '& svg': { fontSize: iconSize.body } }}>
        {info.icon}
        <Box component="span" sx={{ fontSize: typescale.emphasis.size, fontWeight: weight.bold, color: 'text.primary' }}>{info.label}</Box>
      </Box>
      {/* 서비스 이름이 곧 도메인인 경우(짚이는 게 없던 주소) 같은 말을 두 번 쓰지 않는다 */}
      {info.label !== info.host && (
        <Box sx={{ fontSize: typescale.caption.size, color: 'text.secondary', mb: 0.5 }}>{info.host}</Box>
      )}
      {/* 주소 전문 — 세 줄까지. 공유 링크는 열쇠값이 붙어 아주 길다 */}
      <Box sx={{ fontSize: typescale.caption.size, color: 'text.disabled', lineHeight: 1.5, wordBreak: 'break-all', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' }}>
        {info.url}
      </Box>
      <Box sx={{ mt: 0.75, fontSize: typescale.caption.size, color: 'text.disabled' }}>클릭하면 새 탭에서 열립니다</Box>
    </Box>
  )
}

export default function TaskLinkButton({ url, sx }: { url: string; sx?: SxProps<Theme> }) {
  const info = linkInfo(url)
  return (
    <Tooltip
      arrow
      placement="top"
      // 카드 격자를 마우스로 훑고 지나갈 때 튀지 않게 300ms(캘린더 칩 150보다 느리다 — 칩은 호버가
      // 내용을 읽는 유일한 길이지만, 이 아이콘은 겨냥했을 때만 떠야 하는 곁정보다).
      // enterNextDelay 가 없으면 하나 본 뒤 옆 카드로 옮길 때 0ms 로 떠서 따라다니는 느낌이 난다.
      enterDelay={300}
      enterNextDelay={300}
      leaveDelay={0}
      // 미리보기 위로 마우스를 올릴 일이 없다(누를 것이 없다). 끌어서 순서를 바꾸는 격자 위에
      // 남아 있으면 방해만 된다.
      disableInteractive
      // 터치 기기는 길게 눌러도 안 뜬다 — 카드가 이미 스와이프·끌기 제스처를 쓰고 있어 겹치고,
      // 모바일에서는 탭 = 바로 열기가 맞다.
      disableTouchListener
      title={info ? <PreviewBody info={info} /> : url}
      slotProps={{
        tooltip: {
          sx: {
            maxWidth: 320,
            // 표면을 카드색으로 덮으므로 글자색도 짝으로 되돌린다(캘린더 ChipTooltip 과 같은 이유)
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            p: 1.25,
            borderRadius: `${radius.button}px`,
            boxShadow: shadow.md,
          },
        },
        arrow: { sx: { color: 'background.paper', '&::before': { border: '1px solid', borderColor: 'divider' } } },
      }}
    >
      <IconButton
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        size="small"
        aria-label="관련 자료"
        onClick={(e) => e.stopPropagation()}
        sx={mergeSx({ color: 'text.secondary' }, sx)}
      >
        <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
      </IconButton>
    </Tooltip>
  )
}
