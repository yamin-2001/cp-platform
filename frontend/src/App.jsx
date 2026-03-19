import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster }     from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import ProtectedRoute  from './components/ProtectedRoute'
import Layout          from './components/Layout'
import { ROUTES }      from './constants'

import Login             from './pages/Login'
import Register          from './pages/Register'
import Dashboard         from './pages/Dashboard'
import Suggestions       from './pages/Suggestions'
import Problems          from './pages/Problems'
import PracticeSets      from './pages/PracticeSets'
import PracticeSetDetail from './pages/PracticeSetDetail'
import Profile           from './pages/Profile'

const PrivatePage = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
)

const App = () => {
  return (
    <AppProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:   '#16162a',
              color:        '#e8e8f0',
              border:       '1px solid #242438',
              fontFamily:   '"JetBrains Mono", monospace',
              fontSize:     '13px',
              borderRadius: '10px',
            },
            success: { iconTheme: { primary: '#00e676', secondary: '#080810' } },
            error:   { iconTheme: { primary: '#ff5252', secondary: '#080810' } },
          }}
        />
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

          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
