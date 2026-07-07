import { configureStore } from '@reduxjs/toolkit'
import workReducer from './slices/workSlice'
import eqReducer from './slices/eqSlice'
import noticeReducer from './slices/noticeSlice'
import calReducer from './slices/calSlice'
import improveReducer from './slices/improveSlice'
import replyReducer from './slices/replySlice'
import userSettingsReducer from './slices/userSettingsSlice'

export const store = configureStore({
  reducer: {
    work: workReducer,
    eq: eqReducer,
    notice: noticeReducer,
    cal: calReducer,
    improve: improveReducer,
    reply: replyReducer,
    userSettings: userSettingsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
