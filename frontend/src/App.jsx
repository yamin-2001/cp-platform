import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster }     from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import { useAppContext } from './context/appHooks'
import ProtectedRoute  from './components/ProtectedRoute'
import Layout          from './components/Layout'
import ErrorBoundary   from './components/ErrorBoundary'
import NotFound        from './pages/NotFound'
import { ROUTES }      from './constants'
import { UNAUTHORIZED_EVENT } from './api/client'

const Login             = lazy(() => import('./pages/Login'))
const Register          = lazy(() => import('./pages/Register'))
const Dashboard         = lazy(() => import('./pages/Dashboard'))
const Suggestions       = lazy(() => import('./pages/Suggestions'))
const Problems          = lazy(() => import('./pages/Problems'))
const PracticeSets      = lazy(() => import('./pages/PracticeSets'))
const PracticeSetDetail = lazy(() => import('./pages/PracticeSetDetail'))
const Profile           = lazy(() => import('./pages/Profile'))

const PrivatePage = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
)

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-base-100">
    <span className="loading loading-ring loading-lg text-primary" />
  </div>
)

/**
 * Listens for API 401s and performs a soft redirect to the login screen,
 * clearing the session from context. Using a soft redirect (rather than
 * `window.location`) keeps the React tree intact and avoids a race with
 * React Router's own <Navigate> on the initial session check.
 *
 * The redirect only happens when the user is on a protected page. The
 * session-restore call to `/auth/me` 401s for every logged-out visitor,
 * and without this guard that kicked a visitor off the sign-up page: a
 * direct link to `/register` landed on `/login` instead.
 */
const UnauthorizedHandler = () => {
  const { logout } = useAppContext()
  const navigate  = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onUnauthorized = async () => {
      await logout({ silent: true })
      const onAuthPage = location.pathname === ROUTES.LOGIN || location.pathname === ROUTES.REGISTER
      if (!onAuthPage) navigate(ROUTES.LOGIN, { replace: true })
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [logout, navigate, location.pathname])

  return null
}

const App = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <UnauthorizedHandler />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background:   'var(--color-base-200)',
                color:        'var(--color-base-content)',
                border:       '1px solid var(--color-base-300)',
                fontFamily:   'var(--font-mono)',
                fontSize:     '13px',
                borderRadius: '10px',
              },
              success: { iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-base-100)' } },
              error:   { iconTheme: { primary: 'var(--color-error)',   secondary: 'var(--color-base-100)' } },
            }}
          />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path={ROUTES.LOGIN}    element={<Login />} />
              <Route path={ROUTES.REGISTER} element={<Register />} />
              <Route path="/"               element={<Navigate to={ROUTES.DASHBOARD} replace />} />

              <Route path={ROUTES.DASHBOARD}     element={<PrivatePage><Dashboard /></PrivatePage>} />
              <Route path={ROUTES.SUGGESTIONS}   element={<PrivatePage><Suggestions /></PrivatePage>} />
              <Route path={ROUTES.PROBLEMS}      element={<PrivatePage><Problems /></PrivatePage>} />
              <Route path={ROUTES.PRACTICE_SETS} element={<PrivatePage><PracticeSets /></PrivatePage>} />
              <Route path={ROUTES.PRACTICE_SET}  element={<PrivatePage><PracticeSetDetail /></PrivatePage>} />
              <Route path={ROUTES.PROFILE}       element={<PrivatePage><Profile /></PrivatePage>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  )
}

export default App
