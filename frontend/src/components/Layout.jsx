import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  MdDashboard, MdLightbulb, MdSearch, MdLibraryBooks, MdPerson, MdLogout,
  MdMenu, MdMenuOpen, MdSync, MdDarkMode, MdLightMode, MdClose,
} from 'react-icons/md'
import { useAuth, useCFSync } from '../context/appHooks'
import { useTheme } from '../hooks/useTheme'
import { ROUTES } from '../constants'

const NAV_LINKS = [
  { to: ROUTES.DASHBOARD,     label: 'Dashboard',      Icon: MdDashboard    },
  { to: ROUTES.SUGGESTIONS,   label: 'Suggestions',    Icon: MdLightbulb    },
  { to: ROUTES.PROBLEMS,      label: 'Search',         Icon: MdSearch       },
  { to: ROUTES.PRACTICE_SETS, label: 'Practice Sets',  Icon: MdLibraryBooks },
  { to: ROUTES.PROFILE,       label: 'Profile & Sync', Icon: MdPerson       },
]

const Layout = ({ children }) => {
  const { user, logout }      = useAuth()
  const { syncing, syncCF }   = useCFSync()
  const { isDark, toggleTheme } = useTheme()
  const navigate              = useNavigate()
  const location              = useLocation()

  // Desktop: expanded / collapsed rail. Mobile: hidden drawer.
  const [open, setOpen]       = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the mobile drawer whenever the route changes. Done during render
  // (derived state) rather than in an effect to avoid a cascading render.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setMobileOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate(ROUTES.LOGIN)
  }

  // Escape closes the mobile drawer. Without this, keyboard users have no
  // way out of the overlay other than the close button.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const sidebar = (
    <>
      <div className="flex items-center gap-2 px-4 py-4 border-b border-base-300 min-h-[60px]">
        <span className="text-primary text-xl shrink-0" aria-hidden="true">⌥</span>
        {open && (
          <span className="font-display font-extrabold text-lg tracking-tight flex-1">
            CP<span className="text-primary">Lab</span>
          </span>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          className="btn btn-ghost btn-xs text-muted hover:text-primary ml-auto hidden lg:inline-flex"
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={open}
          title={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? <MdMenuOpen size={18} /> : <MdMenu size={18} />}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-3 flex-1" aria-label="Main navigation">
        {NAV_LINKS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={!open ? label : undefined}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-primary/10 text-primary border-l-2 border-primary'
                 : 'text-muted hover:bg-base-300 hover:text-base-content'}`
            }
          >
            <Icon size={18} className="shrink-0" aria-hidden="true" />
            {open && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 py-3 border-t border-base-300 flex flex-col gap-2">
        {user?.codeforcesHandle && (
          <button
            onClick={syncCF}
            disabled={syncing}
            title="Sync CF"
            aria-label="Sync with Codeforces"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-muted hover:text-primary hover:bg-primary/10"
          >
            {syncing ? <span className="loading loading-spinner loading-xs" /> : <MdSync size={16} aria-hidden="true" />}
            {open && (syncing ? 'Syncing…' : 'Sync CF')}
          </button>
        )}

        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-muted hover:text-primary hover:bg-primary/10"
        >
          {/* The icon shows the theme you would switch TO; the visible
              label names the current theme so the two never contradict. */}
          {isDark ? <MdLightMode size={16} aria-hidden="true" /> : <MdDarkMode size={16} aria-hidden="true" />}
          {open && (isDark ? 'Light theme' : 'Dark theme')}
        </button>

        {open && user && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-base-300">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate">{user.name}</p>
              {user.codeforcesHandle && (
                <p className="text-[10px] text-muted truncate">
                  CF: {user.codeforcesHandle}{user.cfRating > 0 && ` · ${user.cfRating}`}
                </p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          title="Logout"
          aria-label="Log out"
          className="btn btn-ghost btn-sm w-full justify-start gap-2 text-muted hover:text-error hover:bg-error/10"
        >
          <MdLogout size={16} aria-hidden="true" />{open && 'Logout'}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-base-100">
      {/* Desktop rail */}
      <aside
        className={`hidden lg:flex flex-col bg-base-200 border-r border-base-300 shrink-0 transition-all duration-200 ${open ? 'w-56' : 'w-16'}`}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer. `inert` keeps the off-screen drawer out of the tab
          order — translating it off-screen alone would leave its links
          focusable for keyboard users. */}
      <div
        className={`lg:hidden fixed inset-0 z-40 ${mobileOpen ? '' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-64 flex flex-col bg-base-200 border-r border-base-300 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            onClick={() => setMobileOpen(false)}
            className="btn btn-ghost btn-xs absolute top-4 right-3 z-10 text-muted"
            aria-label="Close navigation"
          >
            <MdClose size={18} />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="btn btn-ghost btn-sm text-base-content/70"
            aria-label="Open navigation"
          >
            <MdMenu size={20} />
          </button>
          <span className="font-display font-extrabold text-lg tracking-tight">
            CP<span className="text-primary">Lab</span>
          </span>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
