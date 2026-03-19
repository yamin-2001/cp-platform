import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { MdSync, MdCheckCircle, MdError } from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { useAuth, useCFSync } from '../context/AppContext'
import authService from '../services/authService'
import cfService   from '../services/cfService'

const RANK_COLOR = {
  newbie:'text-base-content/50', pupil:'text-success', specialist:'text-cyan-400',
  expert:'text-blue-400', 'candidate master':'text-purple-400', master:'text-warning',
  'international master':'text-warning', grandmaster:'text-error',
  'international grandmaster':'text-error', 'legendary grandmaster':'text-error',
}

const Profile = () => {
  const { user, updateUser }            = useAuth()
  const { syncing, syncCF, syncStatus } = useCFSync()

  const [handle,     setHandle]     = useState(user?.codeforcesHandle || '')
  const [validating, setValidating] = useState(false)
  const [cfPreview,  setCfPreview]  = useState(null)
  const [handleOk,   setHandleOk]   = useState(!!user?.codeforcesHandle)
  const [handleErr,  setHandleErr]  = useState('')

  useEffect(() => {
    setHandle(user?.codeforcesHandle || '')
    setHandleOk(!!user?.codeforcesHandle)
  }, [user?.codeforcesHandle])

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
      toast.success('CF handle saved!')
      setCfPreview(null)
    } else {
      toast.error(data.message)
    }
  }

  return (
    <div className="flex flex-col gap-5 font-mono max-w-2xl">
      <div>
        <h1 className="font-display font-extrabold text-2xl tracking-tight">Profile & Sync</h1>
        <p className="text-base-content/50 text-sm mt-1">Connect your Codeforces account to get personalised suggestions</p>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-4">
          <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Account</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 text-primary text-base font-bold flex items-center justify-center">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-base-content/40">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-4">
          <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Codeforces Handle</h2>
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
                <p className={`text-xs capitalize ${RANK_COLOR[cfPreview.rank?.toLowerCase()] || 'text-base-content/50'}`}>
                  {cfPreview.rank} · {cfPreview.rating} ({cfPreview.maxRating} max)
                </p>
              </div>
              <button className="btn btn-success btn-sm" onClick={saveHandle}>Save Handle</button>
            </div>
          )}
          {user?.codeforcesHandle && !cfPreview && (
            <div className="flex items-center gap-2 text-xs text-base-content/40">
              <MdCheckCircle className="text-success" size={14} />
              Currently linked: <span className="text-base-content font-semibold">{user.codeforcesHandle}</span>
              {user.cfRating > 0 && <span className="text-base-content/60">· {user.cfRating} ({user.cfRank})</span>}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-5 gap-4">
          <h2 className="text-xs font-semibold text-base-content/40 uppercase tracking-wide">Sync Submissions</h2>
          <p className="text-xs text-base-content/50">
            Fetches your full submission history from Codeforces. Solved/attempted problems are
            excluded from suggestions and practice set statuses update automatically.
          </p>
          {syncStatus?.lastSynced && (
            <div className="text-xs text-base-content/40 flex items-center gap-1 flex-wrap">
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
    </div>
  )
}

export default Profile
