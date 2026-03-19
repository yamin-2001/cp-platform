import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MdOpenInNew } from 'react-icons/md'
import practiceSetService from '../services/practiceSetService'
import { ROUTES, PROBLEM_STATUS } from '../constants'

const DIFF_COLOR = { easy:'text-success', medium:'text-warning', hard:'text-error', unrated:'text-base-content/30' }
const DIFF_BADGE = { easy:'badge-success', medium:'badge-warning', hard:'badge-error', unrated:'badge-ghost' }

const PracticeSetDetail = () => {
  const { id }                  = useParams()
  const [set,      setSet]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const load = async () => {
      const data = await practiceSetService.getById(id)
      if (data.success) setSet(data.practiceSet)
      else toast.error(data.message)
      setLoading(false)
    }
    load()
  }, [id])

  const updateStatus = async (entryId, status) => {
    setUpdating(entryId)
    const data = await practiceSetService.updateProblemStatus(id, entryId, { status })
    if (data.success) {
      setSet(data.practiceSet)
      if (status === PROBLEM_STATUS.SOLVED) toast.success('Problem solved! 🎉')
    } else {
      toast.error(data.message)
    }
    setUpdating(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="loading loading-ring loading-lg text-primary" />
    </div>
  )

  if (!set) return (
    <div className="text-center py-20 text-base-content/30 text-sm">
      Practice set not found.{' '}
      <Link to={ROUTES.PRACTICE_SETS} className="text-primary">Go back</Link>
    </div>
  )

  const pct = set.progress.total > 0 ? Math.round(set.progress.solved / set.progress.total * 100) : 0

  return (
    <div className="flex flex-col gap-5 font-mono max-w-5xl">
      <Link to={ROUTES.PRACTICE_SETS} className="text-xs text-base-content/40 hover:text-primary w-fit">
        ← Back to Practice Sets
      </Link>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-display font-extrabold text-xl">{set.title}</h1>
              {set.description && <p className="text-sm text-base-content/50 mt-1">{set.description}</p>}
            </div>
            {set.isCompleted && <div className="badge badge-success gap-1">✓ Completed</div>}
          </div>
          <progress className={`progress w-full h-2 ${pct === 100 ? 'progress-success' : 'progress-primary'}`} value={pct} max={100} />
          <div className="flex items-center gap-4 text-xs text-base-content/50">
            <span className="text-success">✓ {set.progress.solved} solved</span>
            <span className="text-warning">◑ {set.progress.attempted} attempted</span>
            <span>○ {set.progress.total - set.progress.solved - set.progress.attempted} unsolved</span>
            <span className="ml-auto font-bold text-base-content">{pct}%</span>
          </div>
          {set.filters?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {set.filters.tags.map(t => <span key={t} className="badge badge-ghost badge-xs">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra">
            <thead>
              <tr className="text-xs text-base-content/40 uppercase tracking-wide border-b border-base-300">
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
                    <td className="text-base-content/30 text-xs">{idx + 1}</td>
                    <td>
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 group hover:text-primary text-sm">
                        <span className="text-base-content/30 text-xs">{p.contestId}{p.index}.</span>
                        <span className="font-medium">{p.name}</span>
                        <MdOpenInNew size={11} className="opacity-0 group-hover:opacity-50 shrink-0" />
                      </a>
                    </td>
                    <td><span className={`font-bold text-sm ${DIFF_COLOR[p.difficulty]}`}>{p.rating || '?'}</span></td>
                    <td><div className={`badge badge-xs ${DIFF_BADGE[p.difficulty]}`}>{p.difficulty}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {p.tags?.slice(0, 2).map(t => <span key={t} className="badge badge-ghost badge-xs text-[10px]">{t}</span>)}
                        {p.tags?.length > 2 && <span className="badge badge-ghost badge-xs text-[10px]">+{p.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      {entry.status === PROBLEM_STATUS.SOLVED    && <div className="badge badge-success badge-xs">● Solved</div>}
                      {entry.status === PROBLEM_STATUS.ATTEMPTED && <div className="badge badge-warning badge-xs">◑ Tried</div>}
                      {entry.status === PROBLEM_STATUS.UNSOLVED  && <div className="badge badge-ghost   badge-xs">○ Unsolved</div>}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        {entry.status !== PROBLEM_STATUS.SOLVED && (
                          <>
                            {entry.status !== PROBLEM_STATUS.ATTEMPTED && (
                              <button className="btn btn-xs btn-warning btn-outline" disabled={updating === entry._id}
                                onClick={() => updateStatus(entry._id, PROBLEM_STATUS.ATTEMPTED)}>
                                {updating === entry._id ? <span className="loading loading-spinner loading-xs" /> : 'Tried'}
                              </button>
                            )}
                            <button className="btn btn-xs btn-success" disabled={updating === entry._id}
                              onClick={() => updateStatus(entry._id, PROBLEM_STATUS.SOLVED)}>
                              {updating === entry._id ? <span className="loading loading-spinner loading-xs" /> : '✓ Solved'}
                            </button>
                          </>
                        )}
                        {entry.status === PROBLEM_STATUS.SOLVED && (
                          <button className="btn btn-xs btn-ghost text-base-content/30" disabled={updating === entry._id}
                            onClick={() => updateStatus(entry._id, PROBLEM_STATUS.UNSOLVED)}>
                            Undo
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
    </div>
  )
}

export default PracticeSetDetail
