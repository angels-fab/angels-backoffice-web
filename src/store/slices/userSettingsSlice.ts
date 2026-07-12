import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { fetchMySettings, mergeMySettings, type UserSettings } from '@/api/userSettings'

/** 로그인 사용자의 개인화 설정(캘린더·업무 뷰, 카드 순서, 새 글 읽음(seen.*) 등) — 계정별 서버 저장. */
export const loadUserSettings = createAsyncThunk('userSettings/load', async (): Promise<UserSettings> => {
  return fetchMySettings()
})

interface UserSettingsState {
  settings: UserSettings
  ready: boolean
  /** 서버 로드 '성공' 여부 — ready는 실패(rejected)여도 true가 되므로,
   *  자동 저장(markSeen 등 사용자 조작 없는 저장)은 이 플래그로 게이트해 서버 설정 덮어쓰기를 방지 */
  loadedOk: boolean
  /** 저장 대상 사용자 이름(profiles.name) — RLS user_name과 일치해야 저장됨 */
  userName: string | null
}

const initialState: UserSettingsState = { settings: {}, ready: false, loadedOk: false, userName: null }

let saveTimer: ReturnType<typeof setTimeout> | null = null
/** 디바운스 창 동안 이 세션이 바꾼 키만 누적 — 플러시 때 이 패치만 서버에 병합.
 *  (전체 settings 스냅샷 업로드 금지 — stale 탭이 타 세션 값을 롤백하는 LWW 사고 방지) */
let pendingPatch: UserSettings = {}

const slice = createSlice({
  name: 'userSettings',
  initialState,
  reducers: {
    setUserName(state, action: PayloadAction<string | null>) {
      state.userName = action.payload
    },
    setSetting(state, action: PayloadAction<{ key: string; value: unknown }>) {
      state.settings[action.payload.key] = action.payload.value
    },
    resetUserSettings() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
      pendingPatch = {}
      return initialState
    },
  },
  extraReducers: (b) => {
    // fulfilled: 서버값을 깔되, 로드 완료 '전'에 사용자가 이 세션에서 이미 바꾼 키(로컬 settings에만
    // 존재)는 유지 — 늦게 도착한 서버값이 방금 조작을 화면에서 되돌리지 않게.
    b.addCase(loadUserSettings.fulfilled, (s, a) => {
      s.settings = { ...a.payload, ...s.settings }
      s.ready = true
      s.loadedOk = true
    })
      .addCase(loadUserSettings.rejected, (s) => { s.ready = true })
  },
})

export const { setUserName, setSetting, resetUserSettings } = slice.actions
export default slice.reducer

/**
 * 설정 키 하나를 낙관 갱신 + 디바운스(0.8s) 서버 저장. 로그인 안 됐으면(userName 없음) 로컬만 갱신.
 * 서버 저장은 이 세션이 바꾼 키만 병합(mergeMySettings) — 타 키는 건드리지 않는다.
 * dispatch(putSetting({ key: 'cal.view', value })) 식으로 사용.
 */
export const putSetting = createAsyncThunk(
  'userSettings/put',
  async (arg: { key: string; value: unknown }, { dispatch, getState }) => {
    dispatch(setSetting(arg))
    const st = getState() as { userSettings: UserSettingsState }
    if (!st.userSettings.userName) return
    pendingPatch[arg.key] = arg.value
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const patch = pendingPatch
      pendingPatch = {}
      saveTimer = null
      void mergeMySettings(patch).catch(() => {})
    }, 800)
  },
)
