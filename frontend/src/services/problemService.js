import client from '../api/client'

const problemService = {
  getSuggestions: (params) => client.get('/problems/suggestions', params),
  search:         (params) => client.get('/problems/search',      params),
  syncBank:       ()        => client.get('/problems/sync-bank'),
  getTags:        ()        => client.get('/problems/tags'),
}

export default problemService
