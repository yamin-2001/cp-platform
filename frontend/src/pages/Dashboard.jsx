import React from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts'
import { MdSync, MdLightbulb, MdCheckCircle, MdTrendingUp, MdTimer, MdTouchApp, MdLibraryBooks } from 'react-icons/md'
import Page from '../components/Page'
import { useAuth, useCFSync } from '../context/appHooks'
import useDashboard from '../hooks/useDashboard'
import { ROUTES, DIFF_FILL, practiceSetPath } from '../constants'
import { formatDistanceToNow } from 'date-fns'

const Dashboard = () => {
  const { user }                                   = useAuth()
  const { syncing, syncCF, syncStatus, hasHandle } = useCFSync()
  const { stats, recentSets, loading }             = useDashboard()

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="loading loading-ring loading-lg text-primary" />
    </div>
  )

  const diffData = [
    { name: 'Easy',   value: stats?.easyCount   || 0, fill: DIFF_FILL.easy },
    { name: 'Medium', value: stats?.mediumCount  || 0, fill: DIFF_FILL.medium },
    { name: 'Hard',   value: stats?.hardCount    || 0, fill: DIFF_FILL.hard },
  ]
  const activityData = (stats?.recentActivity || []).slice(-14)
    .map(d => ({ date: d._id.slice(5), solved: d.count }))
  const lastSynced = syncStatus?.lastSynced || stats?.lastSynced

  return (
    <Page width="max-w-6xl" className="gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight">Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            Welcome back, <span className="text-primary font-semibold">{user?.name}</span>
            {user?.codeforcesHandle && (
              <span className="ml-2 text-subtle">
                · CF: {user.codeforcesHandle}{user.cfRating > 0 && ` (${user.cfRating})`}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={syncCF} disabled={syncing || !hasHandle} className="btn btn-outline btn-sm gap-1.5">
            {syncing ? <span className="loading loading-spinner loading-xs" /> : <MdSync size={16} />}
            Sync CF
          </button>
          <Link to={ROUTES.SUGGESTIONS} className="btn btn-primary btn-sm gap-1">
            <MdLightbulb size={16} /> Get Suggestions
          </Link>
        </div>
      </div>

      <div className="alert bg-base-200 border border-base-300 py-2 text-xs">
        <MdTimer className="text-muted shrink-0" size={15} />
        <span className="text-muted">
          Last CF sync:{' '}
          <span className="text-base-content/80">
            {lastSynced ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true }) : 'Never'}
          </span>
        </span>
        {!hasHandle && (
          <Link to={ROUTES.PROFILE} className="btn btn-xs btn-warning ml-auto">Set CF Handle</Link>
        )}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { icon: <MdCheckCircle className="text-success" size={22} />, label: 'CF Solved',      value: stats?.totalSolved    ?? 0, border: 'border-l-success'   },
          { icon: <MdTouchApp className="text-warning" size={22} />,   label: 'CF Attempted',   value: stats?.totalAttempted ?? 0, border: 'border-l-warning'   },
          { icon: <MdLibraryBooks className="text-primary" size={22} />,label: 'Practice Sets',  value: stats?.totalSets      ?? 0, border: 'border-l-primary'   },
          { icon: <MdTrendingUp className="text-secondary" size={22} />,label: 'Sets Completed', value: stats?.completedSets  ?? 0, border: 'border-l-secondary' },
        ].map(c => (
          <div key={c.label} className={`card bg-base-200 border border-base-300 border-l-4 ${c.border}`}>
            <div className="card-body p-4 flex flex-row items-center gap-3">
              <div className="shrink-0">{c.icon}</div>
              <div>
                <div className="font-display font-extrabold text-2xl leading-none">{c.value}</div>
                <div className="text-xs text-muted mt-1 uppercase tracking-wide">{c.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[260px_1fr] gap-4">
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5">
            <h2 className="font-semibold text-sm mb-2">Difficulty Breakdown</h2>
            {stats?.totalSolved > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <RadialBarChart cx="50%" cy="50%" innerRadius={28} outerRadius={80}
                    data={diffData} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--color-base-300)' }}>
                      {diffData.map(d => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </RadialBar>
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="flex justify-around mt-1">
                  {diffData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                      {d.name} <strong className="text-base-content">{d.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-subtle text-sm">Sync CF to see stats</div>
            )}
          </div>
        </div>
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5">
            <h2 className="font-semibold text-sm mb-2">
              Activity <span className="text-subtle font-normal">(last 14 days)</span>
            </h2>
            {activityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={activityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--color-base-content)' }} opacity={0.4} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-content)' }} opacity={0.4} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-base-300)', opacity: 0.3 }}
                    contentStyle={{
                      background: 'var(--color-base-100)',
                      border: '1px solid var(--color-base-300)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: 'var(--color-base-content)',
                    }}
                    labelStyle={{ color: 'var(--color-base-content)' }}
                    itemStyle={{ color: 'var(--color-base-content)' }}
                  />
                  <Bar dataKey="solved" radius={[4, 4, 0, 0]}>
                    {activityData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === activityData.length - 1 ? 'var(--color-chart-accent)' : 'var(--color-base-300)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-subtle text-sm">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Recent Practice Sets</h2>
            <Link to={ROUTES.PRACTICE_SETS} className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {recentSets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {recentSets.map(set => {
                const pct = set.progress.total > 0 ? Math.round(set.progress.solved / set.progress.total * 100) : 0
                return (
                  <Link key={set._id} to={practiceSetPath(set._id)}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-base-300 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{set.title}</p>
                      <p className="text-xs text-muted">{set.progress.total} problems</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <progress className="progress progress-primary w-20 h-1.5" value={pct} max={100} />
                      <span className="text-xs text-muted w-8 text-right">{pct}%</span>
                    </div>
                    {set.isCompleted && <div className="badge badge-success badge-xs">✓</div>}
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-subtle text-sm">No practice sets yet</p>
              <Link to={ROUTES.SUGGESTIONS} className="btn btn-primary btn-xs">Get suggestions</Link>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}

export default Dashboard
