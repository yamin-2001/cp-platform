import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import practiceSetService from '../services/practiceSetService'

const useDashboard = () => {
  const [stats,      setStats]      = useState(null)
  const [recentSets, setRecentSets] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, setsData] = await Promise.all([
          practiceSetService.getDashboardStats(),
          practiceSetService.getAll({ page: 1, limit: 4 }),
        ])
        if (statsData.success) setStats(statsData.stats)
        if (setsData.success)  setRecentSets(setsData.practiceSets)
      } catch {
        toast.error('Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { stats, recentSets, loading }
}

export default useDashboard
