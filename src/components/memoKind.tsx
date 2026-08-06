import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ChatIcon from '@mui/icons-material/Chat'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import { iconSize, typescale, weight } from '@/theme/tokens'

/**
 * 메모 갈래 (2026-08-06 사용자 지시 — '메모'의 정체성 재정의).
 *
 * 종전 메모는 전부 포털개선요청이었다. 구성원 모두가 쓰는 도구가 되면서 둘로 갈렸다.
 *  · plain(일반메모) … 상태·요청번호·연동 게시판이 **없다**. 작성자만 보고 지목한 사람에게 공유.
 *  · req(요청메모)  … 종전 그대로 — 상태·요청번호·개선요청 게시판 연동, 작성자 + 포털 관리자 열람.
 *
 * **기본값은 일반메모**다(사용자 지정). 개선요청은 고르는 사람만 고른다.
 */
export type MemoKind = 'plain' | 'req'

export const DEFAULT_MEMO_KIND: MemoKind = 'plain'

/**
 * 일반메모가 바뀌었다는 신호(window 이벤트).
 *
 * 만드는 곳(상단바 메모 버튼)과 띄우는 곳(쪽지 레이어)이 서로 다른 가지에 있어 부모 상태를
 * 공유하지 않는다. 소비자가 둘뿐이라 Redux 슬라이스를 새로 만드는 대신, 그리기 시작 신호
 * (MEMO_DRAW_EVENT)와 같은 방식으로 이벤트 하나를 쓴다.
 */
export const PAGE_NOTES_CHANGED = 'angels:page-notes-changed'
export const notifyPageNotesChanged = () => window.dispatchEvent(new Event(PAGE_NOTES_CHANGED))

/** 갈래 고르기 — 메모를 만드는 두 자리(상단바 메모 버튼·그림 옆 입력창)가 같은 UI 를 쓴다 */
export function MemoKindPicker({ value, onChange, disabled }: {
  value: MemoKind
  onChange: (v: MemoKind) => void
  disabled?: boolean
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      disabled={disabled}
      // null = 눌린 것을 다시 누른 경우. 갈래는 반드시 하나여야 하므로 무시한다
      onChange={(_, v: MemoKind | null) => { if (v) onChange(v) }}
      aria-label="메모 갈래"
      sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.25, fontSize: typescale.caption.size, fontWeight: weight.bold, textTransform: 'none', gap: 0.5 } }}
    >
      <ToggleButton value="plain" aria-label="일반메모">
        <ChatIcon sx={{ fontSize: iconSize.caption }} />
        일반메모
      </ToggleButton>
      <ToggleButton value="req" aria-label="요청메모">
        <LightbulbIcon sx={{ fontSize: iconSize.caption }} />
        요청메모
      </ToggleButton>
    </ToggleButtonGroup>
  )
}

/** 고른 갈래가 무엇을 뜻하는지 한 줄 — 이름만으로는 차이를 알 수 없다 */
export function MemoKindHint({ kind, loc }: { kind: MemoKind; loc: string | null }) {
  return (
    <Box sx={{ fontSize: typescale.caption.size, color: 'text.secondary' }}>
      {kind === 'plain'
        ? '나만 봅니다. 아래에서 고른 사람에게만 함께 보입니다.'
        : loc
          ? <>개선위치 <b style={{ color: 'inherit' }}>{loc}</b> · 상태 <b>접수</b> — 개선요청 게시판에 함께 올라갑니다</>
          : <>이 화면은 연결된 개선위치가 없어 <b>게시판 접수만</b> 됩니다</>}
    </Box>
  )
}

/** 공유 대상 고르기 — 이름(profiles.name) 여러 명. 비우면 나만 본다 */
export function SharePicker({ people, value, onChange, disabled }: {
  people: string[]
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}) {
  return (
    <Autocomplete
      multiple
      size="small"
      options={people}
      value={value}
      disabled={disabled}
      onChange={(_, v) => onChange(v)}
      renderValue={(vals, getProps) =>
        vals.map((v, i) => {
          const { key, ...rest } = getProps({ index: i })
          return <Chip key={key} size="small" label={v} {...rest} />
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={value.length ? '' : '공유할 사람 (비우면 나만 봅니다)'}
          aria-label="공유 대상"
          sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size } }}
        />
      )}
    />
  )
}

/** 리치 본문에서 글자만 — 접힌 쪽지의 툴팁처럼 한 줄 미리보기가 필요한 자리에 */
export function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}
