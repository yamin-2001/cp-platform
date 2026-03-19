import client from '../api/client'

const cfService = {
  validateHandle: (handle) => client.get(`/cf/validate/${encodeURIComponent(handle)}`),
  sync:           ()        => client.post('/cf/sync'),
  getSyncStatus:  ()        => client.get('/cf/status'),
}

export default cfService
