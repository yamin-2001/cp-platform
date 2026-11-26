import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MdOpenInNew } from 'react-icons/md'
import Page from '../components/Page'
import practiceSetService from '../services/practiceSetService'
import { ROUTES, PROBLEM_STATUS, DIFF_COLOR, DIFF_BADGE, STATUS_META } from '../constants'

const PracticeSetDetail = () => {
  const { id }                  = useParams()
  const [set,      setSet]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [loadError, setLoadError] = useState('')
  // Tracks which row AND which action is in flight, so only the button the
  // user actually pressed shows a spinner.
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await practiceSetService.getById(id)
        if (cancelled) return
        if (data.success) {
          setSet(data.practiceSet)
          setLoadError('')
        } else {
          setLoadError(data.message || 'Failed to load practice set')
        }
      } catch {
        if (!cancelled) setLoadError('Could not reach the server')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const updateStatus = async (entryId, status) => {
    const key = `${entryId}:${status}`
    setUpdating(key)
    try {
      const data = await practiceSetService.updateProblemStatus(id, entryId, { status })
      if (data.success) {
        setSet(data.practiceSet)
        if (status === PROBLEM_STATUS.SOLVED) toast.success('Problem solved!')
      } else {
        toast.error(data.message || 'Failed to update status')
      }
    } catch {
      toast.error('Could not reach the server')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="loading loading-ring loading-lg text-primary" />
    </div>
  )

  if (!set) return (
    <div className="text-center py-20 text-muted text-sm">
      <p>{loadError || 'Practice set not found.'}</p>{' '}
      <Link to={ROUTES.PRACTICE_SETS} className="text-primary hover:underline">Go back</Link>
    </div>
  )

  const pct = set.progress.total > 0 ? Math.round(set.progress.solved / set.progress.total * 100) : 0

  // Derive the unsolved count from the problems array rather than subtracting
  // from `progress`, so it can never render as a negative number if the
  // aggregate and the entries are momentarily out of sync.
  const unsolved = set.problems.filter(
    p => p.problem && p.status !== PROBLEM_STATUS.SOLVED && p.status !== PROBLEM_STATUS.ATTEMPTED,
  ).length

  return (
    <Page>
      <Link to={ROUTES.PRACTICE_SETS} className="text-xs text-muted hover:text-primary w-fit">
        ← Back to Practice Sets
      </Link>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-display font-extrabold text-xl">{set.title}</h1>
              {set.description && <p className="text-sm text-muted mt-1">{set.description}</p>}
            </div>
            {set.isCompleted && <div className="badge badge-success gap-1">✓ Completed</div>}
          </div>
          <progress className={`progress w-full h-2 ${pct === 100 ? 'progress-success' : 'progress-primary'}`} value={pct} max={100} />
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="text-success">✓ {set.progress.solved} solved</span>
            <span className="text-warning">◑ {set.progress.attempted} attempted</span>
            <span>○ {unsolved} unsolved</span>
            <span className="ml-auto font-bold text-base-content">{pct}%</span>
          </div>
          {set.filters?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {set.filters.tags.map(t => <span key={t} className="badge badge-outline badge-xs text-muted">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra">
            <thead>
              <tr className="text-xs text-muted uppercase tracking-wide border-b border-base-300">
                <th className="w-8">#</th><th>Problem</th><th className="w-20">Rating</th>
                <th className="w-24">Difficulty</th><th>Tags</th><th className="w-28">Status</th>
                <th className="w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {set.problems.map((entry, idx) => {
                const p = entry.problem
                if (!p) return null
                return (
                  <tr key={entry._id} className={entry.status === PROBLEM_STATUS.SOLVED ? 'opacity-60' : ''}>
                    <td className="text-subtle text-xs">{idx + 1}</td>
                    <td>
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 group hover:text-primary text-sm">
                        <span className="text-subtle text-xs">{p.contestId}{p.index}.</span>
                        <span className="font-medium">{p.name}</span>
                        <MdOpenInNew size={11} className="opacity-0 group-hover:opacity-50 shrink-0" />
                      </a>
                    </td>
                    <td><span className={`font-bold text-sm ${DIFF_COLOR[p.difficulty]}`}>{p.rating || '?'}</span></td>
                    <td><div className={`badge badge-xs ${DIFF_BADGE[p.difficulty]}`}>{p.difficulty}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {p.tags?.slice(0, 2).map(t => <span key={t} className="badge badge-outline badge-xs text-muted text-[10px]">{t}</span>)}
                        {p.tags?.length > 2 && <span className="badge badge-outline badge-xs text-muted text-[10px]">+{p.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      {entry.status === PROBLEM_STATUS.SOLVED    && <div className="badge badge-success badge-xs">● Solved</div>}
                      {entry.status === PROBLEM_STATUS.ATTEMPTED && <div className="badge badge-warning badge-xs">◑ Tried</div>}
                      {entry.status === PROBLEM_STATUS.UNSOLVED  && <div className="badge badge-outline badge-xs text-muted">○ Unsolved</div>}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        {entry.status !== PROBLEM_STATUS.SOLVED && (
                          <>
                            {entry.status !== PROBLEM_STATUS.ATTEMPTED && (
                              <button className="btn btn-xs btn-warning btn-outline"
                                disabled={updating !== null}
                                onClick={() => updateStatus(entry._id, PROBLEM_STATUS.ATTEMPTED)}>
                                {updating === `${entry._id}:${PROBLEM_STATUS.ATTEMPTED}`
                                  ? <span className="loading loading-spinner loading-xs" /> : 'Tried'}
                              </button>
                            )}
                            <button className="btn btn-xs btn-success" disabled={updating !== null}
                              onClick={() => updateStatus(entry._id, PROBLEM_STATUS.SOLVED)}>
                              {updating === `${entry._id}:${PROBLEM_STATUS.SOLVED}`
                                ? <span className="loading loading-spinner loading-xs" /> : '✓ Solved'}
                            </button>
                          </>
                        )}
                        {entry.status === PROBLEM_STATUS.SOLVED && (
                          <button className="btn btn-xs btn-ghost text-muted" disabled={updating !== null}
                            onClick={() => updateStatus(entry._id, PROBLEM_STATUS.UNSOLVED)}>
                            Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  )
}

export default PracticeSetDetail
