import React, { useReducer, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import authService from '../services/authService'
import cfService   from '../services/cfService'
import { AppContext } from './appContextObject'

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

/**
 * `/cf/status` and `/cf/sync` report the same counters under different keys
 * (totalSolved/solved, totalAttempted/attempted). Normalise both to the
 * `total*` shape so consumers never have to care which endpoint filled
 * `syncStatus`.
 */
const normaliseSyncStatus = (data) => {
  if (!data) return null
  return {
    ...data,
    totalSolved:    data.totalSolved    ?? data.solved    ?? 0,
    totalAttempted: data.totalAttempted ?? data.attempted ?? 0,
    lastSynced:     data.lastSynced     ?? null,
  }
}

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

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    let cancelled = false
    const restoreSession = async () => {
      try {
        const data = await authService.getMe()
        if (cancelled) return
        if (data.success) {
          dispatch({ type: SET_USER, payload: data.user })
          if (data.user?.codeforcesHandle) {
            const status = await cfService.getSyncStatus()
            if (cancelled) return
            if (status.success) {
              dispatch({ type: SET_SYNC_STATUS, payload: normaliseSyncStatus(status) })
            }
          }
        }
      } catch {
        if (!cancelled) dispatch({ type: SET_USER, payload: null })
      } finally {
        if (!cancelled) dispatch({ type: SET_AUTH_LOADING, payload: false })
      }
    }
    restoreSession()
    return () => { cancelled = true }
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

  const logout = useCallback(async ({ silent = false } = {}) => {
    try { await authService.logout() } catch { /* proceed */ } finally {
      dispatch({ type: LOGOUT })
      if (!silent) toast.success('Logged out')
    }
  }, [])

  const updateUser = useCallback((updatedUser) => {
    dispatch({ type: SET_USER, payload: updatedUser })
  }, [])

  /**
   * Re-read `/cf/status` into `syncStatus`.
   *
   * `syncStatus` was only ever populated at session-restore time (and only
   * when the handle was already set) or by `syncCF`. So a user who saved
   * their handle for the first time saw no "Last synced" line at all until
   * they reloaded the page — and the Dashboard, which reads
   * `user.stats.lastSynced`, disagreed with the Profile screen.
   */
  const refreshSyncStatus = useCallback(async () => {
    try {
      const status = await cfService.getSyncStatus()
      if (!status?.success) return null
      const payload = normaliseSyncStatus(status)
      dispatch({ type: SET_SYNC_STATUS, payload })
      return payload
    } catch {
      return null
    }
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
      dispatch({ type: SET_USER, payload: me.user })
      dispatch({
        type: SET_SYNC_STATUS,
        // The sync response has no `lastSynced`; take it from the refreshed
        // user record so the "last synced" timestamp stays accurate.
        payload: normaliseSyncStatus({
          ...data.stats,
          lastSynced: me.user?.stats?.lastSynced ?? new Date().toISOString(),
        }),
      })
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
    login, register, logout, updateUser, syncCF, refreshSyncStatus,
  }), [state, login, register, logout, updateUser, syncCF, refreshSyncStatus])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export default AppProvider
