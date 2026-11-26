import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import practiceSetService from '../services/practiceSetService'

const usePracticeSets = () => {
  const [sets,       setSets]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page,       setPage]       = useState(1)
  const [filter,     setFilter]     = useState({ isCompleted: undefined })

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 9 }
      if (filter.isCompleted !== undefined) params.isCompleted = filter.isCompleted
      const data = await practiceSetService.getAll(params)
      if (data.success) {
        setSets(data.practiceSets)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch {
      toast.error('Failed to load practice sets')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  const remove = useCallback(async (id) => {
    const data = await practiceSetService.delete(id)
    if (data.success) {
      toast.success('Practice set deleted')
      setSets(prev => prev.filter(s => s._id !== id))
      setTotal(prev => Math.max(0, prev - 1))
    } else {
      toast.error(data.message)
    }
  }, [])

  /** Move to the previous page when the current one becomes empty. */
  const goToPrevPageIfEmpty = useCallback((remainingCount) => {
    if (remainingCount === 0 && page > 1) setPage(p => p - 1)
  }, [page])

  return {
    sets, loading, total, totalPages, page, filter,
    setPage, setFilter, fetch, remove, goToPrevPageIfEmpty,
  }
}

export default usePracticeSets
