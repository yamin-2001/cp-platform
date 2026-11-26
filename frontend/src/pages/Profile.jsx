import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { MdSync, MdCheckCircle, MdError } from 'react-icons/md'
import Page from '../components/Page'
import { formatDistanceToNow } from 'date-fns'
import { useAuth, useCFSync } from '../context/appHooks'
import authService from '../services/authService'
import cfService   from '../services/cfService'
import { RANK_COLOR, clampRating } from '../constants'

const Profile = () => {
  const { user, updateUser }            = useAuth()
  const { syncing, syncCF, syncStatus, refreshSyncStatus } = useCFSync()

  const [handle,     setHandle]     = useState(user?.codeforcesHandle || '')
  const [validating, setValidating] = useState(false)
  const [cfPreview,  setCfPreview]  = useState(null)
  const [handleOk,   setHandleOk]   = useState(!!user?.codeforcesHandle)
  const [handleErr,  setHandleErr]  = useState('')
  const [estRating,  setEstRating]  = useState(user?.estimatedRating || 1200)
  const [savingEstimate, setSavingEstimate] = useState(false)

  // Reset the form when the linked handle changes upstream. Adjusting state
  // during render (rather than in an effect) avoids the cascading render
  // React 19 flags for synchronous setState inside an effect.
  const [lastHandle, setLastHandle] = useState(user?.codeforcesHandle)
  if (lastHandle !== user?.codeforcesHandle) {
    setLastHandle(user?.codeforcesHandle)
    setHandle(user?.codeforcesHandle || '')
    setHandleOk(!!user?.codeforcesHandle)
  }

  const validateHandle = async () => {
    if (!handle.trim()) { setHandleErr('Enter a handle'); return }
    setValidating(true); setCfPreview(null); setHandleOk(false); setHandleErr('')
    try {
      const data = await cfService.validateHandle(handle.trim())
      if (data.success) { setCfPreview(data.cfUser); setHandleOk(true) }
      else setHandleErr(data.message)
    } catch {
      setHandleErr('Could not reach Codeforces')
    } finally {
      setValidating(false)
    }
  }

  const saveHandle = async () => {
    if (!cfPreview) return
    const data = await authService.updateProfile({ codeforcesHandle: cfPreview.handle })
    if (data.success) {
      updateUser(data.user)
      // The user had no handle before, so `syncStatus` was never loaded.
      // Without this the "Last synced" line stays hidden until a reload,
      // and the Profile screen disagrees with the Dashboard.
      refreshSyncStatus()
      toast.success('CF handle saved!')
      setCfPreview(null)
    } else {
      toast.error(data.message)
    }
  }

  /** Save the user's own estimate of their level. */
  const saveEstimate = async () => {
    const rating = clampRating(estRating)
    setEstRating(rating)
    setSavingEstimate(true)
    try {
      const data = await authService.updateProfile({ estimatedRating: rating })
      if (!data.success) throw new Error(data.message)
      updateUser(data.user)
      toast.success('Level saved! Suggestions will match this rating.')
    } catch (err) {
      toast.error(err.message || 'Could not save your level')
    } finally {
      setSavingEstimate(false)
    }
  }

  return (
    <Page width="max-w-2xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl tracking-tight">Profile & Sync</h1>
        <p className="text-muted text-sm mt-1">Connect your Codeforces account to get personalised suggestions</p>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Account</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 text-primary text-base font-bold flex items-center justify-center">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Codeforces Handle</h2>
          <div className="flex gap-2">
            <input type="text"
              className={`input input-bordered input-sm flex-1 ${handleErr ? 'input-error' : handleOk ? 'input-success' : ''}`}
              placeholder="e.g. tourist" value={handle}
              onChange={e => { setHandle(e.target.value); setHandleOk(false); setCfPreview(null); setHandleErr('') }}
              onKeyDown={e => e.key === 'Enter' && validateHandle()} />
            <button className="btn btn-outline btn-sm" onClick={validateHandle} disabled={validating}>
              {validating ? <span className="loading loading-spinner loading-xs" /> : 'Verify'}
            </button>
          </div>
          {handleErr && (
            <div className="flex items-center gap-2 text-error text-xs"><MdError size={14} /> {handleErr}</div>
          )}
          {cfPreview && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-base-300 border border-success/20">
              {cfPreview.avatar && <img src={cfPreview.avatar} alt="avatar" className="w-10 h-10 rounded-full" />}
              <div className="flex-1">
                <p className="font-semibold flex items-center gap-1 text-sm">
                  <MdCheckCircle className="text-success" size={14} /> {cfPreview.handle}
                </p>
                <p className={`text-xs capitalize ${RANK_COLOR[cfPreview.rank?.toLowerCase()] || 'text-muted'}`}>
                  {cfPreview.rank} · {cfPreview.rating} ({cfPreview.maxRating} max)
                </p>
              </div>
              <button className="btn btn-success btn-sm" onClick={saveHandle}>Save Handle</button>
            </div>
          )}
          {user?.codeforcesHandle && !cfPreview && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <MdCheckCircle className="text-success" size={14} />
              Currently linked: <span className="text-base-content font-semibold">{user.codeforcesHandle}</span>
              {user.cfRating > 0 && <span className="text-muted">· {user.cfRating} ({user.cfRank})</span>}
            </div>
          )}
        </div>
      </div>

      {/* Shown only when there is no real Codeforces rating to work from. */}
      {user?.cfRating > 0 ? (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5 gap-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Sync Submissions</h2>
          <p className="text-xs text-muted">
            Fetches your full submission history from Codeforces. Solved/attempted problems are
            excluded from suggestions and practice set statuses update automatically.
          </p>
          {syncStatus?.lastSynced && (
            <div className="text-xs text-muted flex items-center gap-1 flex-wrap">
              <MdSync size={13} />
              Last synced:{' '}
              <span className="text-base-content/70">
                {formatDistanceToNow(new Date(syncStatus.lastSynced), { addSuffix: true })}
              </span>
              <span className="ml-2">· {syncStatus.totalSolved} solved · {syncStatus.totalAttempted} attempted on CF</span>
            </div>
          )}
          <button className="btn btn-primary gap-2 w-full" onClick={syncCF} disabled={syncing || !user?.codeforcesHandle}>
            {syncing
              ? <><span className="loading loading-spinner loading-sm" /> Syncing submissions…</>
              : <><MdSync size={18} /> Sync with Codeforces</>
            }
          </button>
          {!user?.codeforcesHandle && (
            <p className="text-xs text-warning text-center">Set and verify your CF handle above first</p>
          )}
          </div>
        </div>
      ) : (
        /* No Codeforces account: the suggestions need *some* level to work
           from, and a flat 1200 guess is wrong for most people. */
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-5 gap-4">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Your Level</h2>
            <p className="text-xs text-muted">
              Suggestions are matched to a rating. Link a Codeforces account for an exact
              rating, or set your own estimate below.
            </p>
            <div className="flex items-end gap-2">
              <label className="form-control flex-1">
                <div className="label py-0">
                  <span className="label-text text-xs uppercase tracking-wide">Estimated rating</span>
                </div>
                <input type="number" min={800} max={3500} step={50}
                  className="input input-bordered input-sm"
                  value={estRating}
                  onChange={e => setEstRating(e.target.value === '' ? '' : Number(e.target.value))}
                  onBlur={() => setEstRating(clampRating(estRating))} />
              </label>
              <button className="btn btn-primary btn-sm" onClick={saveEstimate} disabled={savingEstimate}>
                {savingEstimate ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
              </button>
            </div>
            <p className="text-xs text-subtle">
              Not sure? 800–1200 beginner · 1200–1600 intermediate · 1600–1900 advanced.
            </p>
            <button className="btn btn-outline btn-sm gap-2 w-full" onClick={syncCF} disabled={syncing || !user?.codeforcesHandle}>
              {syncing
                ? <><span className="loading loading-spinner loading-xs" /> Syncing submissions…</>
                : <><MdSync size={16} /> Sync with Codeforces instead</>
              }
            </button>
            {!user?.codeforcesHandle && (
              <p className="text-xs text-warning text-center">Set and verify your CF handle above to use sync</p>
            )}
          </div>
        </div>
      )}
    </Page>
  )
}

export default Profile
