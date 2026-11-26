import React from 'react'
import { MdCheckCircle } from 'react-icons/md'

const CODE_LINES = [
  'int dp[N][N];', 'sort(v.begin(),v.end());', 'binary_search(a,a+n,x);',
  'priority_queue<int> pq;', 'unordered_map<int,int> mp;', 'lower_bound(a,a+n,x);',
  'vector<pair<int,int>> v;', 'memset(dp,-1,sizeof dp);', 'for(int i=0;i<n;i++)',
  'if(vis[node]) return;', 'dfs(adj[node][i]);', 'long long ans = 0LL;',
]

const FEATURES = [
  { icon: '◈', text: "Problems you've never attempted" },
  { icon: '◉', text: 'Synced with your CF account'   },
  { icon: '◧', text: 'Filter by tags & rating'        },
  { icon: '◐', text: 'Auto-track your progress'       },
]

/**
 * Shared shell for the login and register screens: brand panel on the left,
 * decorative code-rain panel on the right (desktop only).
 */
const AuthLayout = ({ children }) => (
  <div className="min-h-screen grid lg:grid-cols-2 bg-base-100">
    <div className="flex flex-col justify-center px-6 sm:px-10 md:px-16 bg-base-200 lg:border-r lg:border-base-300">
      <div className="mb-10">
        <span className="text-primary text-3xl" aria-hidden="true">⌥</span>
        <h1 className="font-display font-extrabold text-3xl mt-2 tracking-tight">
          CP<span className="text-primary">Lab</span>
        </h1>
        <p className="text-muted text-xs tracking-widest uppercase mt-1">
          Competitive Programming Training
        </p>
      </div>
      {children}
    </div>

    <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-base-100">
      {/* Code rain. Each column repeats the snippet list so the stream is
          long enough to cover the viewport as it falls — a single copy
          would only travel a short distance before the column ran out. */}
      <div className="absolute inset-0 flex gap-4 p-4 opacity-[0.14] pointer-events-none overflow-hidden" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 text-primary text-[10px] rain-col flex-1 whitespace-nowrap"
            style={{ animationDelay: `${-(i * 1.7)}s`, animationDuration: `${11 + (i % 5) * 2.4}s` }}>
            {Array.from({ length: 4 }).flatMap((_, r) =>
              CODE_LINES.map((l, j) => (
                <span key={`${r}-${j}`} className={r % 2 ? 'opacity-60' : ''}>{l}</span>
              )),
            )}
          </div>
        ))}
      </div>
      <div className="relative z-10 text-center px-12">
        <h2 className="font-display font-extrabold text-4xl leading-tight mb-8 bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
          Train Smarter.<br />Rank Higher.
        </h2>
        <ul className="flex flex-col gap-3 text-left max-w-xs mx-auto">
          {FEATURES.map(f => (
            <li key={f.text} className="bg-base-200/80 border border-base-300 rounded-lg px-4 py-2.5 text-sm text-base-content/80 flex items-center gap-2.5 backdrop-blur-sm">
              <span className="text-primary shrink-0" aria-hidden="true">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
)

export default AuthLayout
