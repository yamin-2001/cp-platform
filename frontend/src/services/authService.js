import client from '../api/client'

const authService = {
  register:      (body) => client.post('/auth/register',       body),
  login:         (body) => client.post('/auth/login',          body),
  logout:        ()     => client.post('/auth/logout'),
  getMe:         ()     => client.get('/auth/me'),
  updateProfile: (body) => client.put('/auth/update-profile',  body),
}

export default authService