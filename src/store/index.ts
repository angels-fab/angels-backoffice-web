import { configureStore } from '@reduxjs/toolkit'
import workReducer from './slices/workSlice'
import eqReducer from './slices/eqSlice'

export const store = configureStore({
  reducer: {
    work: workReducer,
    eq: eqReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
