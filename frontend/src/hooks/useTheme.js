import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'cplab-theme'

export const THEMES = {
  NIGHT: 'cplab-night',
  LIGHT: 'cplab-light',
}

const isValid = (t) => Object.values(THEMES).includes(t)

const readInitial = () => {
  if (typeof window === 'undefined') return THEMES.NIGHT
  // The inline script in index.html has already applied the theme to
  // <html data-theme> before React mounts; read it back so the hook's
  // first render agrees with the DOM and the theme doesn't flip on mount.
  const applied = document.documentElement.getAttribute('data-theme')
  if (isValid(applied)) return applied
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (isValid(stored)) return stored
  // Fall back to the OS preference on first visit.
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return THEMES.LIGHT
  return THEMES.NIGHT
}

export const useTheme = () => {
  const [theme, setThemeState] = useState(readInitial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((t) => {
    if (isValid(t)) setThemeState(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === THEMES.NIGHT ? THEMES.LIGHT : THEMES.NIGHT))
  }, [])

  return { theme, setTheme, toggleTheme, isDark: theme === THEMES.NIGHT }
}

export default useTheme
