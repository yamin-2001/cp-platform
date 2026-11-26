import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/appHooks'
import AuthLayout from '../components/AuthLayout'
import { ROUTES, MIN_PASSWORD_LENGTH } from '../constants'

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', codeforcesHandle: '' })
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate     = useNavigate()

  const field = (key) => ({
    value:    form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    setLoading(true)
    try {
      await register(form)
      toast.success('Account created!')
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm w-full">
        <div>
          <h2 className="font-display font-bold text-xl">Create Account</h2>
          <p className="text-muted text-sm mt-1">Start your journey</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="form-control">
            <div className="label pt-0"><span className="label-text text-xs uppercase tracking-wide">Name</span></div>
            <input type="text" className="input input-bordered input-sm" placeholder="Your name" required {...field('name')} />
          </label>
          <label className="form-control">
            <div className="label pt-0">
              <span className="label-text text-xs uppercase tracking-wide">CF Handle</span>
              <span className="label-text-alt text-muted">optional</span>
            </div>
            <input type="text" className="input input-bordered input-sm" placeholder="tourist" {...field('codeforcesHandle')} />
          </label>
        </div>
        <label className="form-control">
          <div className="label pt-0"><span className="label-text text-xs uppercase tracking-wide">Email</span></div>
          <input type="email" className="input input-bordered input-sm" placeholder="you@example.com" required {...field('email')} />
        </label>
        <label className="form-control">
          <div className="label pt-0"><span className="label-text text-xs uppercase tracking-wide">Password</span></div>
          <input type="password" className="input input-bordered input-sm" placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`} required minLength={MIN_PASSWORD_LENGTH} {...field('password')} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm mt-2" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-xs" /> : 'Create Account'}
        </button>
        <p className="text-center text-sm text-muted mt-1">
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="text-primary hover:underline">Sign in →</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default Register
