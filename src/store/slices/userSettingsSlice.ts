import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { fetchMySettings, saveMySettings, type UserSettings } from '@/api/userSettings'

/** 로그인 사용자의 개인화 설정(캘린더·업무 뷰, 카드 순서, 마지막 확인시각 등) — 계정별 서버 저장. */
export const loadUserSettings = createAsyncThunk('userSettings/load', async (): Promise<UserSettings> => {
  return fetchMySettings()
})

interface UserSettingsState {
  settings: UserSettings
  ready: boolean
  /** 저장 대상 사용자 이름(profiles.name) — RLS user_name과 일치해야 저장됨 */
  userName: string | null
}

const initialState: UserSettingsState = { settings: {}, ready: false, userName: null }

let saveTimer: ReturnType<typeof setTimeout> | null = null

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
      return initialState
    },
  },
  extraReducers: (b) => {
    b.addCase(loadUserSettings.fulfilled, (s, a) => { s.settings = a.payload; s.ready = true })
      .addCase(loadUserSettings.rejected, (s) => { s.ready = true })
  },
})

export const { setUserName, setSetting, resetUserSettings } = slice.actions
export default slice.reducer

/**
 * 설정 키 하나를 낙관 갱신 + 디바운스(0.8s) 서버 저장. 로그인 안 됐으면(userName 없음) 로컬만 갱신.
 * dispatch(putSetting({ key: 'cal.view', value })) 식으로 사용.
 */
export const putSetting = createAsyncThunk(
  'userSettings/put',
  async (arg: { key: string; value: unknown }, { dispatch, getState }) => {
    dispatch(setSetting(arg))
    const st = getState() as { userSettings: UserSettingsState }
    const { userName, settings } = st.userSettings
    if (!userName) return
    const snapshot = { ...settings }
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { void saveMySettings(userName, snapshot).catch(() => {}) }, 800)
  },
)
