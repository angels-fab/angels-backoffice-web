import { configureStore } from '@reduxjs/toolkit'
import workReducer from './slices/workSlice'
import eqReducer from './slices/eqSlice'
import noticeReducer from './slices/noticeSlice'

export const store = configureStore({
  reducer: {
    work: workReducer,
    eq: eqReducer,
    notice: noticeReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
