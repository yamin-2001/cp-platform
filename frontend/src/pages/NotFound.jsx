import React from 'react'
import { Link } from 'react-router-dom'
import { MdSearchOff } from 'react-icons/md'
import { ROUTES } from '../constants'

const NotFound = () => (
  <div className="min-h-screen bg-base-100 flex items-center justify-center p-6">
    <div className="flex flex-col items-center gap-4 text-center">
      <MdSearchOff className="text-subtle" size={48} aria-hidden="true" />
      <div>
        <h1 className="font-display font-extrabold text-3xl">404</h1>
        <p className="text-muted text-sm mt-2">
          That page doesn't exist.
        </p>
      </div>
      <Link to={ROUTES.DASHBOARD} className="btn btn-primary btn-sm">
        Back to dashboard
      </Link>
    </div>
  </div>
)

export default NotFound
