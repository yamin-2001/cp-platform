import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MdDelete, MdOpenInNew, MdLightbulb, MdLibraryBooks, MdCheckCircle, MdTouchApp } from 'react-icons/md'
import Page from '../components/Page'
import usePracticeSets from '../hooks/usePracticeSets'
import DeleteConfirm from '../components/DeleteConfirm'
import { ROUTES, practiceSetPath, STATUS_META, PROBLEM_STATUS } from '../constants'

const PracticeSets = () => {
  const { sets, loading, totalPages, page, filter, setPage, setFilter, fetch, remove, goToPrevPageIfEmpty } = usePracticeSets()
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  const activeTab = filter.isCompleted === true ? 'completed' : filter.isCompleted === false ? 'active' : 'all'

  const handleTabChange = (tab) => {
    setFilter({ isCompleted: tab === 'completed' ? true : tab === 'active' ? false : undefined })
    setPage(1)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    await remove(pendingDelete._id)
    // If that was the last set on this page, step back a page rather than
    // leaving the user staring at an empty list.
    goToPrevPageIfEmpty(sets.length - 1)
    setDeleting(false)
    setPendingDelete(null)
  }

  return (
    <Page>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight">Practice Sets</h1>
          <p className="text-muted text-sm mt-1">Your training history</p>
        </div>
        <Link to={ROUTES.SUGGESTIONS} className="btn btn-primary btn-sm gap-1">
          <MdLightbulb size={16} aria-hidden="true" /> New Set
        </Link>
      </div>

      <div className="tabs tabs-boxed bg-base-200 w-fit" role="tablist">
        {['all', 'active', 'completed'].map(tab => (
          <button key={tab} role="tab" aria-selected={activeTab === tab}
            onClick={() => handleTabChange(tab)}
            className={`tab tab-sm capitalize ${activeTab === tab ? 'tab-active' : ''}`}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><span className="loading loading-ring loading-lg text-primary" /></div>
      ) : sets.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-muted">
          <p className="text-sm">No practice sets found</p>
          <Link to={ROUTES.SUGGESTIONS} className="btn btn-primary btn-sm">Get suggestions</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sets.map(set => (
            <SetCard key={set._id} set={set} onDelete={() => setPendingDelete(set)} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button className="btn btn-outline btn-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="text-xs text-muted">{page} / {totalPages}</span>
          <button className="btn btn-outline btn-xs" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      <DeleteConfirm
        open={!!pendingDelete}
        title="Delete practice set?"
        message={`"${pendingDelete?.title}" and its progress will be permanently deleted.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </Page>
  )
}

const SetCard = ({ set, onDelete }) => {
  const pct  = set.progress.total > 0 ? Math.round(set.progress.solved / set.progress.total * 100) : 0
  const date = new Date(set.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="card bg-base-200 border border-base-300 hover:border-base-content/20 transition-colors">
      <div className="card-body p-5 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{set.title}</h3>
            <p className="text-xs text-muted mt-0.5">{date}</p>
          </div>
          {set.isCompleted && (
            <div className="badge badge-success badge-xs shrink-0 gap-1">
              <MdCheckCircle size={11} aria-hidden="true" /> Done
            </div>
          )}
        </div>
        {set.description && <p className="text-xs text-muted line-clamp-2">{set.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-outline badge-xs text-muted gap-1">
            <MdLibraryBooks size={11} aria-hidden="true" /> {set.progress.total}
          </span>
          <span className="badge badge-outline badge-xs text-success gap-1">
            <MdCheckCircle size={11} aria-hidden="true" /> {set.progress.solved}
          </span>
          <span className="badge badge-outline badge-xs text-warning gap-1">
            <MdTouchApp size={11} aria-hidden="true" /> {set.progress.attempted}
          </span>
          {set.filters?.tags?.slice(0, 2).map(t => <span key={t} className="badge badge-outline badge-xs text-muted">{t}</span>)}
          {set.filters?.tags?.length > 2 && <span className="badge badge-outline badge-xs text-muted">+{set.filters.tags.length - 2}</span>}
        </div>
        <div className="flex items-center gap-2">
          <progress className={`progress flex-1 h-1.5 ${pct === 100 ? 'progress-success' : 'progress-primary'}`}
            value={pct} max={100} aria-label={`${pct}% solved`} />
          <span className="text-xs text-muted w-8 text-right">{pct}%</span>
        </div>
        <div className="card-actions justify-end mt-1">
          <button className="btn btn-ghost btn-xs text-error hover:bg-error/10"
            onClick={onDelete} aria-label={`Delete ${set.title}`} title="Delete practice set">
            <MdDelete size={14} aria-hidden="true" />
          </button>
          <Link to={practiceSetPath(set._id)} className="btn btn-primary btn-xs gap-1">
            <MdOpenInNew size={13} aria-hidden="true" /> Open
          </Link>
        </div>
      </div>
    </div>
  )
}

export default PracticeSets
