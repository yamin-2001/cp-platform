import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/appHooks'
import AuthLayout from '../components/AuthLayout'
import { ROUTES } from '../constants'

const Login = () => {
  const [form,    setForm]    = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login }             = useAuth()
  const navigate              = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form)
      toast.success('Welcome back!')
      navigate(ROUTES.DASHBOARD)
    } catch (err) {
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full">
        <div>
          <h2 className="font-display font-bold text-xl">Sign In</h2>
          <p className="text-muted text-sm mt-1">Continue your training session</p>
        </div>
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text text-xs uppercase tracking-wide">Email</span>
          </div>
          <input type="email" className="input input-bordered input-sm"
            placeholder="you@example.com" required
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="form-control">
          <div className="label py-1">
            <span className="label-text text-xs uppercase tracking-wide">Password</span>
          </div>
          <input type="password" className="input input-bordered input-sm"
            placeholder="••••••••" required
            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm mt-2" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-xs" /> : 'Sign In'}
        </button>
        <p className="text-center text-sm text-muted mt-1">
          No account?{' '}
          <Link to={ROUTES.REGISTER} className="text-primary hover:underline">Create one →</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default Login
