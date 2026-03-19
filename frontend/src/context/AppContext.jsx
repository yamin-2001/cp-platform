import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import authService from '../services/authService'
import cfService   from '../services/cfService'

const initialState = {
  user:        null,
  authLoading: true,
  syncing:     false,
  syncStatus:  null,
}

const SET_USER         = 'SET_USER'
const SET_AUTH_LOADING = 'SET_AUTH_LOADING'
const SET_SYNCING      = 'SET_SYNCING'
const SET_SYNC_STATUS  = 'SET_SYNC_STATUS'
const LOGOUT           = 'LOGOUT'

const appReducer = (state, { type, payload }) => {
  switch (type) {
    case SET_USER:         return { ...state, user: payload }
    case SET_AUTH_LOADING: return { ...state, authLoading: payload }
    case SET_SYNCING:      return { ...state, syncing: payload }
    case SET_SYNC_STATUS:  return { ...state, syncStatus: payload }
    case LOGOUT:           return { ...initialState, authLoading: false }
    default:               return state
  }
}

const AppContext = createContext(null)

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await authService.getMe()
        if (data.success) {
          dispatch({ type: SET_USER, payload: data.user })
          if (data.user?.codeforcesHandle) {
            const status = await cfService.getSyncStatus()
            if (status.success) dispatch({ type: SET_SYNC_STATUS, payload: status })
          }
        }
      } catch {
        dispatch({ type: SET_USER, payload: null })
      } finally {
        dispatch({ type: SET_AUTH_LOADING, payload: false })
      }
    }
    restoreSession()
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials)
    if (!data.success) throw new Error(data.message)
    const me = await authService.getMe()
    dispatch({ type: SET_USER, payload: me.user })
    return me.user
  }, [])

  const register = useCallback(async (credentials) => {
    const data = await authService.register(credentials)
    if (!data.success) throw new Error(data.message)
    const me = await authService.getMe()
    dispatch({ type: SET_USER, payload: me.user })
    return me.user
  }, [])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch { /* proceed */ } finally {
      dispatch({ type: LOGOUT })
      toast.success('Logged out')
    }
  }, [])

  const updateUser = useCallback((updatedUser) => {
    dispatch({ type: SET_USER, payload: updatedUser })
  }, [])

  const syncCF = useCallback(async () => {
    if (!state.user?.codeforcesHandle) {
      toast.error('Set your Codeforces handle in Profile first')
      return null
    }
    dispatch({ type: SET_SYNCING, payload: true })
    const syncToast = toast.loading('Syncing with Codeforces…')
    try {
      const data = await cfService.sync()
      if (!data.success) throw new Error(data.message)
      const me = await authService.getMe()
      dispatch({ type: SET_USER,        payload: me.user })
      dispatch({ type: SET_SYNC_STATUS, payload: data.stats })
      toast.success(
        `Synced! ${data.stats.solved} solved · ${data.stats.autoMarked} sets updated`,
        { id: syncToast }
      )
      return data.stats
    } catch (e) {
      toast.error(e.message || 'Sync failed', { id: syncToast })
      return null
    } finally {
      dispatch({ type: SET_SYNCING, payload: false })
    }
  }, [state.user])

  const value = useMemo(() => ({
    user:        state.user,
    authLoading: state.authLoading,
    syncing:     state.syncing,
    syncStatus:  state.syncStatus,
    isAuthenticated: !!state.user,
    hasHandle:       !!state.user?.codeforcesHandle,
    hasSynced:       !!state.user?.stats?.lastSynced,
    login, register, logout, updateUser, syncCF,
  }), [state, login, register, logout, updateUser, syncCF])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>')
  return ctx
}

export const useAuth = () => {
  const { user, authLoading, isAuthenticated, login, register, logout, updateUser } = useAppContext()
  return { user, authLoading, isAuthenticated, login, register, logout, updateUser }
}

export const useCFSync = () => {
  const { syncing, syncStatus, hasHandle, hasSynced, syncCF } = useAppContext()
  return { syncing, syncStatus, hasHandle, hasSynced, syncCF }
}
