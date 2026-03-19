import client from '../api/client'

const practiceSetService = {
  getDashboardStats:   ()              => client.get('/practicesets/stats'),
  getAll:              (params)        => client.get('/practicesets', params),
  getById:             (id)            => client.get(`/practicesets/${id}`),
  create:              (body)          => client.post('/practicesets', body),
  updateProblemStatus: (id, eid, body) => client.put(`/practicesets/${id}/problems/${eid}`, body),
  delete:              (id)            => client.delete(`/practicesets/${id}`),
}

export default practiceSetService
