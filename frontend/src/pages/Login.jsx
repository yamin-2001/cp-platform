import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AppContext'
import { ROUTES } from '../constants'

const CODE_LINES = [
  'int dp[N][N];', 'sort(v.begin(),v.end());', 'binary_search(a,a+n,x);',
  'priority_queue<int> pq;', 'unordered_map<int,int> mp;', 'lower_bound(a,a+n,x);',
  'vector<pair<int,int>> v;', 'memset(dp,-1,sizeof dp);', 'for(int i=0;i<n;i++)',
  'if(vis[node]) return;', 'dfs(adj[node][i]);', 'long long ans = 0LL;',
]

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-base-100 font-mono">
      <div className="flex flex-col justify-center px-8 md:px-16 bg-base-200 border-r border-base-300">
        <div className="mb-10">
          <span className="text-primary text-3xl">⌥</span>
          <h1 className="font-display font-extrabold text-3xl mt-2 tracking-tight">
            CP<span className="text-primary">Lab</span>
          </h1>
          <p className="text-base-content/40 text-xs tracking-widest uppercase mt-1">
            Competitive Programming Training
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm w-full">
          <div>
            <h2 className="font-display font-bold text-xl">Sign In</h2>
            <p className="text-base-content/50 text-sm mt-1">Continue your training session</p>
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
          <p className="text-center text-sm text-base-content/50 mt-1">
            No account?{' '}
            <Link to={ROUTES.REGISTER} className="text-primary hover:underline">Create one →</Link>
          </p>
        </form>
      </div>
      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-base-100">
        <div className="absolute inset-0 flex gap-3 p-4 opacity-[0.06] pointer-events-none overflow-hidden">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 text-primary text-[10px] rain-col flex-1 whitespace-nowrap"
              style={{ animationDelay: `${i * 0.55}s` }}>
              {CODE_LINES.map((l, j) => <span key={j}>{l}</span>)}
            </div>
          ))}
        </div>
        <div className="relative z-10 text-center px-12">
          <h2 className="font-display font-extrabold text-4xl leading-tight mb-8 bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
            Train Smarter.<br />Rank Higher.
          </h2>
          <ul className="flex flex-col gap-3 text-left max-w-xs mx-auto">
            {["🎯 Problems you've never attempted", '📊 Synced with your CF account',
              '🏷️ Filter by tags & rating', '⚡ Auto-track your progress'].map(f => (
              <li key={f} className="bg-base-200 border border-base-300 rounded-lg px-4 py-2.5 text-sm text-base-content/70">{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Login
