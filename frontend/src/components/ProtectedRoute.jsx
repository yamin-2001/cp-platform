import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AppContext'

const ProtectedRoute = ({ children }) => {
  const { authLoading, isAuthenticated } = useAuth()

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-100">
        <span className="loading loading-ring loading-lg text-primary" />
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default ProtectedRoute
