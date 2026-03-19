import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { MdOpenInNew, MdAdd, MdSync, MdLightbulb } from 'react-icons/md'
import { useCFSync } from '../context/AppContext'
import useSuggestions from '../hooks/useSuggestions'
import practiceSetService from '../services/practiceSetService'
import { ROUTES, STRATEGY } from '../constants'

const STRATEGIES = [
  { key: STRATEGY.SMART,   label: 'Smart',   desc: 'At your level'    },
  { key: STRATEGY.UPSOLVE, label: 'Upsolve', desc: 'Build confidence' },
  { key: STRATEGY.STRETCH, label: 'Stretch', desc: 'Push limits'      },
  { key: STRATEGY.RANDOM,  label: 'Random',  desc: 'Surprise me'      },
]

const ALL_TAGS = [
  'dp','graphs','greedy','math','binary search','implementation',
  'data structures','strings','trees','number theory','geometry',
  'two pointers','bitmasks','dfs and similar','sortings',
]

const DIFF_COLOR = { easy:'text-success', medium:'text-warning', hard:'text-error', unrated:'text-base-content/30' }
const DIFF_BADGE = { easy:'badge-success', medium:'badge-warning', hard:'badge-error', unrated:'badge-ghost' }

const Suggestions = () => {
  const navigate = useNavigate()
  const { syncing, syncCF, hasHandle } = useCFSync()
  const {
    suggestions, loading, meta,
    strategy, setStrategy,
    tags, setTags, toggleTag,
    count, setCount,
    selected, toggleSelect, selectAll, clearSelected,
    fetch,
  } = useSuggestions()

  const [showModal, setShowModal] = useState(false)
  const [setTitle,  setSetTitle]  = useState('')
  const [creating,  setCreating]  = useState(false)

  useEffect(() => { fetch() }, []) // eslint-disable-line

  const handleCreateSet = async () => {
    if (!setTitle.trim()) { toast.error('Enter a title'); return }
    const ids = selected.size > 0 ? [...selected] : suggestions.map(s => s._id)
    setCreating(true)
    try {
      const data = await practiceSetService.create({ title: setTitle, problemIds: ids })
      if (!data.success) throw new Error(data.message)
      toast.success('Practice set created!')
      setShowModal(false); setSetTitle(''); clearSelected()
      navigate(ROUTES.PRACTICE_SETS)
    } catch (err) {
      toast.error(err.message || 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 font-mono max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight flex items-center gap-2">
            <MdLightbulb className="text-primary" /> Suggestions
          </h1>
          <p className="text-base-content/50 text-sm mt-1">
            Problems you have <span className="text-primary font-semibold">never attempted</span> on Codeforces
            {meta && <span className="ml-2 text-base-content/30">· {meta.excluded} excluded · {meta.rMin}–{meta.rMax}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={syncCF} disabled={syncing || !hasHandle} className="btn btn-outline btn-sm gap-1">
            {syncing ? <span className="loading loading-spinner loading-xs" /> : <MdSync size={16} />}
            Sync CF
          </button>
          {suggestions.length > 0 && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm gap-1">
              <MdAdd size={16} /> Save as Set
              {selected.size > 0 && <span className="badge badge-xs badge-primary-content">{selected.size}</span>}
            </button>
          )}
        </div>
      </div>

      {!hasHandle && (
        <div className="alert alert-warning text-sm">
          ⚠️ Set your CF handle in{' '}
          <Link to={ROUTES.PROFILE} className="underline font-semibold">Profile</Link>{' '}
          to get personalised suggestions.
        </div>
      )}

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4 gap-4">
          <div>
            <p className="text-xs text-base-content/40 uppercase tracking-wide mb-2">Strategy</p>
            <div className="flex gap-2 flex-wrap">
              {STRATEGIES.map(s => (
                <button key={s.key}
                  onClick={() => { setStrategy(s.key); clearSelected(); fetch() }}
                  className={`btn btn-sm gap-1 ${strategy === s.key ? 'btn-primary' : 'btn-ghost border border-base-300'}`}>
                  {s.label}
                  <span className={`text-[10px] ${strategy === s.key ? 'text-primary-content/70' : 'text-base-content/30'}`}>
                    — {s.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-base-content/40 uppercase tracking-wide">Tags</p>
              {tags.length > 0 && (
                <button onClick={() => { setTags([]); fetch() }} className="text-xs text-base-content/30 hover:text-error">Clear</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className={`badge cursor-pointer text-xs px-2.5 py-2 ${tags.includes(t) ? 'badge-primary' : 'badge-outline text-base-content/50 hover:badge-ghost'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-base-content/40 uppercase tracking-wide">Count</span>
              <select className="select select-bordered select-xs w-20"
                value={count} onChange={e => setCount(Number(e.target.value))}>
                {[10, 15, 20, 25, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={() => fetch()} className="btn btn-ghost btn-xs gap-1">
              <MdSync size={14} /> Refresh
            </button>
            {meta?.userRating > 0 && (
              <span className="text-xs text-base-content/30 ml-auto">
                Your CF rating: <span className="text-primary">{meta.userRating}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {suggestions.length > 0 && !loading && (
        <div className="flex items-center gap-3 text-xs text-base-content/40">
          <button onClick={selectAll} className="hover:text-primary">Select all</button>
          <span>·</span>
          <button onClick={clearSelected} className="hover:text-primary">Clear</button>
          {selected.size > 0 && <span className="text-primary">{selected.size} selected</span>}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><span className="loading loading-ring loading-lg text-primary" /></div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-base-content/30">
          <MdLightbulb size={40} />
          <p className="text-sm">No unseen problems found. Try a different strategy or sync your CF account.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map(p => (
            <div key={p._id}
              className={`card bg-base-200 border transition-colors cursor-pointer ${selected.has(p._id) ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-base-content/20'}`}
              onClick={() => toggleSelect(p._id)}>
              <div className="card-body p-4 flex flex-row items-start gap-3">
                <input type="checkbox" className="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0"
                  checked={selected.has(p._id)} onChange={() => toggleSelect(p._id)}
                  onClick={e => e.stopPropagation()} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-sm hover:text-primary flex items-center gap-1 group"
                      onClick={e => e.stopPropagation()}>
                      <span className="text-base-content/40 text-xs">{p.contestId}{p.index}.</span>
                      {p.name}
                      <MdOpenInNew size={12} className="opacity-0 group-hover:opacity-60 shrink-0" />
                    </a>
                    <div className={`badge badge-xs ${DIFF_BADGE[p.difficulty]}`}>{p.difficulty}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.reasons?.map(r => <span key={r} className="badge badge-ghost badge-xs text-base-content/50">{r}</span>)}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.tags?.slice(0, 4).map(t => <span key={t} className="badge badge-ghost badge-xs text-[10px]">{t}</span>)}
                    {p.tags?.length > 4 && <span className="badge badge-ghost badge-xs text-[10px]">+{p.tags.length - 4}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold text-sm ${DIFF_COLOR[p.difficulty]}`}>{p.rating || '?'}</div>
                  <div className="text-[10px] text-base-content/30 mt-0.5">{p.solvedCount?.toLocaleString()} AC</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-200 border border-base-300">
            <h3 className="font-display font-bold text-lg mb-2">Save as Practice Set</h3>
            <p className="text-sm text-base-content/50 mb-4">
              {selected.size > 0 ? `${selected.size} selected problems` : `All ${suggestions.length} problems`} will be added.
            </p>
            <label className="form-control mb-4">
              <div className="label py-1"><span className="label-text text-xs uppercase tracking-wide">Title *</span></div>
              <input type="text" className="input input-bordered input-sm" placeholder="e.g. DP Warmup"
                value={setTitle} onChange={e => setSetTitle(e.target.value)} autoFocus />
            </label>
            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowModal(false); setSetTitle('') }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreateSet} disabled={creating}>
                {creating ? <span className="loading loading-spinner loading-xs" /> : 'Create'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  )
}

export default Suggestions
