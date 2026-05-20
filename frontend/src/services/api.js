import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't redirect for logout or getMe — those are handled by authStore
      const isAuthManaged = url.includes('/auth/logout') || url.includes('/auth/me');
      // Don't redirect if already on login/register page
      const onAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';

      if (!isAuthManaged && !onAuthPage) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me')
};

// Rooms
export const roomsAPI = {
  getAll: () => api.get('/rooms'),
  getOne: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.patch(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  addParticipant: (roomId, userId) => api.post(`/rooms/${roomId}/participants`, { userId }),
  removeParticipant: (roomId, userId) => api.delete(`/rooms/${roomId}/participants/${userId}`),
  toggleScreenSharing: (roomId, enabled) => api.patch(`/rooms/${roomId}`, { screenSharingEnabled: enabled }),
  toggleLock: (roomId, isLocked) => api.patch(`/rooms/${roomId}`, { isLocked })
};

// Users
export const usersAPI = {
  getAll: () => api.get('/users'),
  getActive: () => api.get('/users/active'),
  create: (data) => api.post('/users', data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  updateProfile: (data) => api.patch('/users/profile', data),
  activate: (id) => api.patch(`/users/${id}/activate`),
  deactivate: (id) => api.delete(`/users/${id}/deactivate`),
  deleteUser: (id) => api.delete(`/users/${id}`)
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  syncRooms: () => api.post('/admin/sync-rooms'),
  deleteRoom: (id) => api.delete(`/rooms/${id}`)
};

export default api;
