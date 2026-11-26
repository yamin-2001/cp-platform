import React from 'react'
import { MdOpenInNew, MdSearch } from 'react-icons/md'
import Page from '../components/Page'
import useProblemSearch from '../hooks/useProblemSearch'
import { DIFF_COLOR, DIFF_BADGE, STATUS_META, PROBLEM_STATUS, clampRating } from '../constants'

const StatusBadge = ({ status }) => {
  if (status === PROBLEM_STATUS.SOLVED) {
    return <span className="badge badge-success badge-xs">{STATUS_META.solved.glyph} Solved</span>
  }
  if (status === PROBLEM_STATUS.ATTEMPTED) {
    return <span className="badge badge-warning badge-xs">{STATUS_META.attempted.glyph} Tried</span>
  }
  return <span className="badge badge-outline badge-xs text-muted">{STATUS_META.new.glyph} New</span>
}

const Problems = () => {
  const { problems, loading, total, totalPages, filters, setFilter, setPage } = useProblemSearch()

  return (
    <Page>
      <div>
        <h1 className="font-display font-extrabold text-2xl tracking-tight">Problem Search</h1>
        <p className="text-muted text-sm mt-1">
          {total > 0 ? `${total.toLocaleString()} problems` : 'Search the Codeforces problem bank'}
          {' '}· your CF status shown inline
        </p>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4 gap-3">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <input type="text" className="input input-bordered input-sm w-full pl-9"
              placeholder="Search by name or problem ID (e.g. 1234A)…"
              value={filters.q} onChange={e => setFilter('q', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="form-control gap-1">
              <label className="label py-0"><span className="label-text text-xs uppercase tracking-wide">Difficulty</span></label>
              <div className="join">
                {['all', 'easy', 'medium', 'hard'].map(d => (
                  <button key={d} onClick={() => setFilter('difficulty', d)}
                    className={`btn btn-xs join-item capitalize ${filters.difficulty === d ? 'btn-primary' : 'btn-ghost border border-base-300'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-control gap-1">
              <label className="label py-0" htmlFor="min-rating">
                <span className="label-text text-xs uppercase tracking-wide">Rating</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input id="min-rating" type="number" min={800} max={3500} step={100}
                  className="input input-bordered input-xs w-20 text-center"
                  value={filters.minRating}
                  onChange={e => setFilter('minRating', e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => setFilter('minRating', clampRating(Number(e.target.value)))} />
                <span className="text-muted text-xs" aria-hidden="true">–</span>
                <input id="max-rating" type="number" min={800} max={3500} step={100}
                  className="input input-bordered input-xs w-20 text-center"
                  aria-label="Maximum rating"
                  value={filters.maxRating}
                  onChange={e => setFilter('maxRating', e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={e => setFilter('maxRating', clampRating(Number(e.target.value)))} />
              </div>
            </div>
            <div className="form-control gap-1 flex-1 min-w-[160px]">
              <label className="label py-0">
                <span className="label-text text-xs uppercase tracking-wide">Tags</span>
                <span className="label-text-alt text-subtle">comma-separated</span>
              </label>
              <input type="text" className="input input-bordered input-xs" placeholder="dp, greedy, graphs"
                value={filters.tags} onChange={e => setFilter('tags', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <span className="text-xs text-muted">Hide solved</span>
              <input type="checkbox" className="toggle toggle-primary toggle-xs"
                checked={filters.hideSolved} onChange={e => setFilter('hideSolved', e.target.checked)} />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><span className="loading loading-ring loading-lg text-primary" /></div>
      ) : problems.length === 0 ? (
        <div className="text-center py-20 text-subtle text-sm">No problems found. Adjust filters or sync the problem bank.</div>
      ) : (
        <div className="card bg-base-200 border border-base-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-sm table-zebra">
              <thead>
                <tr className="text-xs text-muted uppercase tracking-wide border-b border-base-300">
                  <th>Problem</th><th className="w-20">Rating</th><th className="w-24">Difficulty</th>
                  <th>Tags</th><th className="w-28">Your Status</th><th className="w-24 text-right">AC Count</th>
                </tr>
              </thead>
              <tbody>
                {problems.map(p => (
                  <tr key={p._id} className={`hover ${p.userStatus === PROBLEM_STATUS.SOLVED ? 'opacity-70' : ''}`}>
                    <td>
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 group hover:text-primary text-sm">
                        <span className="text-muted text-xs shrink-0">{p.contestId}{p.index}.</span>
                        <span className="font-medium">{p.name}</span>
                        <MdOpenInNew size={11} className="opacity-0 group-hover:opacity-50 shrink-0" />
                      </a>
                    </td>
                    <td><span className={`font-bold text-sm ${DIFF_COLOR[p.difficulty]}`}>{p.rating || '?'}</span></td>
                    <td><div className={`badge badge-xs ${DIFF_BADGE[p.difficulty]}`}>{p.difficulty}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {p.tags?.slice(0, 3).map(t => <span key={t} className="badge badge-outline badge-xs text-muted text-[10px]">{t}</span>)}
                        {p.tags?.length > 3 && <span className="badge badge-outline badge-xs text-muted text-[10px]">+{p.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td><StatusBadge status={p.userStatus} /></td>
                    <td className="text-right text-xs text-muted">{p.solvedCount?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button className="btn btn-outline btn-xs" disabled={filters.page === 1} onClick={() => setPage(filters.page - 1)}>← Prev</button>
          <span className="text-xs text-muted">Page {filters.page} of {totalPages}</span>
          <button className="btn btn-outline btn-xs" disabled={filters.page === totalPages} onClick={() => setPage(filters.page + 1)}>Next →</button>
        </div>
      )}
    </Page>
  )
}

export default Problems
