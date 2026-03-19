import { useState, useCallback } from 'react'
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

  const fetch = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const params = { strategy, count }
      if (tags.length) params.tags = tags.join(',')
      const data = await problemService.getSuggestions(params)
      if (data.success) { setSuggestions(data.suggestions); setMeta(data.meta) }
      else toast.error(data.message)
    } catch {
      toast.error('Failed to fetch suggestions')
    } finally {
      setLoading(false)
    }
  }, [strategy, count, tags])

  const toggleTag = useCallback((tag) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }, [])

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
    strategy, setStrategy,
    tags, setTags, toggleTag,
    count, setCount,
    selected, toggleSelect, selectAll, clearSelected,
    fetch,
  }
}

export default useSuggestions
