import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import problemService from '../services/problemService'

const useProblemSearch = () => {
  const [problems,   setProblems]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [filters, setFilters] = useState({
    q: '', minRating: 800, maxRating: 3500,
    difficulty: 'all', tags: '', hideSolved: false, page: 1,
  })

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        minRating: filters.minRating, maxRating: filters.maxRating,
        page: filters.page, limit: 25, hideSolved: filters.hideSolved,
      }
      if (filters.q.trim())             params.q          = filters.q.trim()
      if (filters.difficulty !== 'all') params.difficulty = filters.difficulty
      if (filters.tags.trim())          params.tags       = filters.tags
      const data = await problemService.search(params)
      if (data.success) {
        setProblems(data.problems)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch {
      toast.error('Failed to load problems')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetch() }, [fetch])

  return { problems, loading, total, totalPages, filters, setFilter, setPage }
}

export default useProblemSearch
