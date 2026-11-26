import { useContext } from 'react'
import { AppContext } from './appContextObject'

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
  const { syncing, syncStatus, hasHandle, hasSynced, syncCF, refreshSyncStatus } = useAppContext()
  return { syncing, syncStatus, hasHandle, hasSynced, syncCF, refreshSyncStatus }
}
