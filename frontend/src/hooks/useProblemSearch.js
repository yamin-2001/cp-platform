import { useState, useCallback, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import problemService from '../services/problemService'
import useDebounce from './useDebounce'
import { clampRating, RATING_MIN, RATING_MAX } from '../constants'

const useProblemSearch = () => {
  const [problems,   setProblems]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [filters, setFilters] = useState({
    q: '', minRating: RATING_MIN, maxRating: RATING_MAX,
    difficulty: 'all', tags: '', hideSolved: false, page: 1,
  })

  // Only the text inputs are debounced; discrete controls (difficulty,
  // page, toggle) should apply immediately.
  const debouncedQ    = useDebounce(filters.q, 350)
  const debouncedTags = useDebounce(filters.tags, 350)
  const debouncedMin  = useDebounce(filters.minRating, 350)
  const debouncedMax  = useDebounce(filters.maxRating, 350)

  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }, [])

  const setPage = useCallback((page) => {
    setFilters(prev => ({ ...prev, page }))
  }, [])

  // Guards against out-of-order responses: only the newest request may
  // commit its result.
  const requestId = useRef(0)

  // `loading` is derived from whether the results currently on screen match
  // the query that is currently active. When they diverge we are mid-fetch.
  const [loadedKey, setLoadedKey] = useState(null)

  const queryKey = JSON.stringify({
    q: debouncedQ.trim(), tags: debouncedTags.trim(),
    min: clampRating(debouncedMin), max: clampRating(debouncedMax),
    difficulty: filters.difficulty, hideSolved: filters.hideSolved,
    page: filters.page,
  })

  useEffect(() => {
    const id = ++requestId.current
    let cancelled = false

    const run = async () => {
      try {
        const params = {
          minRating: clampRating(debouncedMin),
          maxRating: clampRating(debouncedMax),
          page: filters.page,
          limit: 25,
          hideSolved: filters.hideSolved,
        }
        if (debouncedQ.trim())            params.q          = debouncedQ.trim()
        if (filters.difficulty !== 'all') params.difficulty = filters.difficulty
        if (debouncedTags.trim())         params.tags       = debouncedTags.trim()

        const data = await problemService.search(params)
        if (cancelled || id !== requestId.current) return
        if (data.success) {
          setProblems(data.problems)
          setTotal(data.total)
          setTotalPages(data.totalPages)
          setLoadedKey(queryKey)
        }
      } catch {
        if (cancelled || id !== requestId.current) return
        toast.error('Failed to load problems')
        setLoadedKey(queryKey)
      }
    }

    run()
    return () => { cancelled = true }
  }, [queryKey, debouncedQ, debouncedTags, debouncedMin, debouncedMax, filters.page, filters.difficulty, filters.hideSolved])

  // A fetch is in flight while the on-screen results don't yet correspond
  // to the active query.
  const loading = loadedKey !== queryKey

  return { problems, loading, total, totalPages, filters, setFilter, setPage }
}

export default useProblemSearch
