import { configureStore } from '@reduxjs/toolkit'
import workReducer from './slices/workSlice'
import eqReducer from './slices/eqSlice'
import noticeReducer from './slices/noticeSlice'
import calReducer from './slices/calSlice'
import improveReducer from './slices/improveSlice'
import milestoneReducer from './slices/milestoneSlice'
import replyReducer from './slices/replySlice'
import userSettingsReducer from './slices/userSettingsSlice'
import pageNotesReducer from './slices/pageNotesSlice'

export const store = configureStore({
  reducer: {
    work: workReducer,
    eq: eqReducer,
    notice: noticeReducer,
    cal: calReducer,
    improve: improveReducer,
    milestone: milestoneReducer,
    reply: replyReducer,
    userSettings: userSettingsReducer,
    pageNotes: pageNotesReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
