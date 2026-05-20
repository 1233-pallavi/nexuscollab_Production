import { create } from 'zustand';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  // Start in loading state if a token exists — prevents flash of login page
  isLoading: !!localStorage.getItem('token'),
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      set({ isLoading: true });
      const { data } = await authAPI.getMe();
      set({ user: data.user, token, isAuthenticated: true, isLoading: false });
      connectSocket(token);
    } catch {
      // Token invalid/expired — clean up silently, no redirect needed
      // (App.jsx will redirect to /login via ProtectedRoute)
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem('token', data.token);
      // Fetch full user profile from getMe to ensure role and all fields are current
      const { data: meData } = await authAPI.getMe();
      set({ user: meData.user, token: data.token, isAuthenticated: true, isLoading: false });
      connectSocket(data.token);
      return { success: true };
    } catch (err) {
      localStorage.removeItem('token');
      const message = err.response?.data?.error || 'Login failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.register({ username, email, password });
      localStorage.setItem('token', data.token);
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
      connectSocket(data.token);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false, error: null });
    // Force redirect to login — works from any page including admin routes
    window.location.href = '/login';
  },

  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
  clearError: () => set({ error: null })
}));

export default useAuthStore;
