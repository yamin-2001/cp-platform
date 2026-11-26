import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import practiceSetService from '../services/practiceSetService'

const useDashboard = () => {
  const [stats,      setStats]      = useState(null)
  const [recentSets, setRecentSets] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      // allSettled so a failure in one panel doesn't discard the other.
      const [statsResult, setsResult] = await Promise.allSettled([
        practiceSetService.getDashboardStats(),
        practiceSetService.getAll({ page: 1, limit: 4 }),
      ])

      if (cancelled) return

      if (statsResult.status === 'fulfilled' && statsResult.value?.success) {
        setStats(statsResult.value.stats)
      }
      if (setsResult.status === 'fulfilled' && setsResult.value?.success) {
        setRecentSets(setsResult.value.practiceSets)
      }

      const statsFailed = statsResult.status === 'rejected' || !statsResult.value?.success
      const setsFailed  = setsResult.status  === 'rejected' || !setsResult.value?.success
      if (statsFailed && setsFailed) toast.error('Failed to load dashboard')

      setLoading(false)
    }

    load().catch(() => {
      if (cancelled) return
      toast.error('Failed to load dashboard')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return { stats, recentSets, loading }
}

export default useDashboard
