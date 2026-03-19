import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { MdDashboard, MdLightbulb, MdSearch, MdLibraryBooks, MdPerson, MdLogout, MdMenu, MdMenuOpen, MdSync } from 'react-icons/md'
import { useAuth, useCFSync } from '../context/AppContext'
import { ROUTES } from '../constants'

const NAV_LINKS = [
  { to: ROUTES.DASHBOARD,     label: 'Dashboard',      Icon: MdDashboard    },
  { to: ROUTES.SUGGESTIONS,   label: 'Suggestions',    Icon: MdLightbulb    },
  { to: ROUTES.PROBLEMS,      label: 'Search',         Icon: MdSearch       },
  { to: ROUTES.PRACTICE_SETS, label: 'Practice Sets',  Icon: MdLibraryBooks },
  { to: ROUTES.PROFILE,       label: 'Profile & Sync', Icon: MdPerson       },
]

const Layout = ({ children }) => {
  const { user, logout }    = useAuth()
  const { syncing, syncCF } = useCFSync()
  const navigate            = useNavigate()
  const [open, setOpen]     = useState(true)

  const handleLogout = async () => {
    await logout()
    navigate(ROUTES.LOGIN)
  }

  return (
    <div className="flex min-h-screen bg-base-100 font-mono">

      <aside className={`flex flex-col bg-base-200 border-r border-base-300 shrink-0 transition-all duration-200 ${open ? 'w-56' : 'w-16'}`}>

        <div className="flex items-center gap-2 px-4 py-4 border-b border-base-300 min-h-[60px]">
          <span className="text-primary text-xl shrink-0">⌥</span>
          {open && (
            <span className="font-display font-extrabold text-lg tracking-tight flex-1">
              CP<span className="text-primary">Lab</span>
            </span>
          )}
          <button onClick={() => setOpen(o => !o)}
            className="btn btn-ghost btn-xs text-base-content/40 hover:text-primary ml-auto">
            {open ? <MdMenuOpen size={18} /> : <MdMenu size={18} />}
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-2 py-3 flex-1">
          {NAV_LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} title={!open ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-primary/10 text-primary border-l-2 border-primary'
                   : 'text-base-content/50 hover:bg-base-300 hover:text-base-content'}`
              }>
              <Icon size={18} className="shrink-0" />
              {open && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-base-300 flex flex-col gap-2">
          {user?.codeforcesHandle && (
            <button onClick={syncCF} disabled={syncing} title="Sync CF"
              className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/40 hover:text-primary hover:bg-primary/10">
              {syncing ? <span className="loading loading-spinner loading-xs" /> : <MdSync size={16} />}
              {open && (syncing ? 'Syncing…' : 'Sync CF')}
            </button>
          )}

          {open && user && (
            <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-base-300">
              <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate">{user.name}</p>
                {user.codeforcesHandle && (
                  <p className="text-[10px] text-base-content/40 truncate">
                    CF: {user.codeforcesHandle}{user.cfRating > 0 && ` · ${user.cfRating}`}
                  </p>
                )}
              </div>
            </div>
          )}

          <button onClick={handleLogout} title="Logout"
            className="btn btn-ghost btn-sm w-full justify-start gap-2 text-base-content/40 hover:text-error hover:bg-error/10">
            <MdLogout size={16} />{open && 'Logout'}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}

export default Layout
