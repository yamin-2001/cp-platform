import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import problemService from '../services/problemService'
import { STRATEGY }   from '../constants'

const useSuggestions = () => {
  const [suggestions, setSuggestions] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [meta,        setMeta]        = useState(null)
  const [strategy,    setStrategy]    = useState(STRATEGY.SMART)
  const [tags,        setTags]        = useState([])
  const [count,       setCount]       = useState(20)
  const [selected,    setSelected]    = useState(new Set())

  // Guards against out-of-order responses overwriting a newer result.
  const requestId = useRef(0)

  /**
   * Fetch suggestions.
   *
   * `overrides` lets a caller request with values that are not yet reflected
   * in state. Without it, calling `setTags([...])` and then `fetch()` in the
   * same tick sends the *previous* tags, because the callback still closes
   * over the old state — which is why the "Clear" button used to re-request
   * with the tags it had just cleared.
   */
  const fetch = useCallback(async (overrides = {}) => {
    const id = ++requestId.current
    const nextStrategy = overrides.strategy ?? strategy
    const nextTags     = overrides.tags ?? tags
    const nextCount    = overrides.count ?? count

    setLoading(true)
    setSelected(new Set())
    try {
      const params = { strategy: nextStrategy, count: nextCount }
      if (nextTags.length) params.tags = nextTags.join(',')
      const data = await problemService.getSuggestions(params)
      if (id !== requestId.current) return
      if (data.success) { setSuggestions(data.suggestions); setMeta(data.meta) }
      else toast.error(data.message)
    } catch {
      if (id !== requestId.current) return
      toast.error('Failed to fetch suggestions')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [strategy, tags, count])

  /** Toggle a tag and immediately re-fetch with the new tag set. */
  const toggleTag = useCallback((tag) => {
    // The next tag set is computed *outside* the state updater. Triggering
    // the request from inside `setTags(prev => …)` meant the updater had a
    // side effect, and StrictMode double-invokes updaters — so every tag
    // click fired two identical requests.
    const next = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
    setTags(next)
    fetch({ tags: next })
  }, [tags, fetch])

  /** Clear every tag filter and re-fetch. */
  const clearTags = useCallback(() => {
    setTags([])
    fetch({ tags: [] })
  }, [fetch])

  /** Change the strategy and re-fetch. */
  const setStrategyAndFetch = useCallback((next) => {
    setStrategy(next)
    fetch({ strategy: next })
  }, [fetch])

  /** Change the requested count and re-fetch. */
  const setCountAndFetch = useCallback((next) => {
    setCount(next)
    fetch({ count: next })
  }, [fetch])

  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll     = useCallback(() => setSelected(new Set(suggestions.map(s => s._id))), [suggestions])
  const clearSelected = useCallback(() => setSelected(new Set()), [])

  return {
    suggestions, loading, meta,
    strategy, setStrategyAndFetch,
    tags, clearTags, toggleTag,
    count, setCountAndFetch,
    selected, toggleSelect, selectAll, clearSelected,
    fetch,
  }
}

export default useSuggestions
