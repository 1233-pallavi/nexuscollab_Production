import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  // Clean up any stale disconnected socket before creating a new one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    // Use polling only on production — Render free tier doesn't reliably support
    // WebSocket upgrades. Polling works through any proxy/CDN.
    transports: SOCKET_URL.includes('localhost') ? ['websocket', 'polling'] : ['polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
    // If server closed the connection, attempt manual reconnect
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  socket.on('reconnect', (attempt) => {
    console.log(`🔄 Socket reconnected after ${attempt} attempt(s)`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`🔄 Reconnection attempt #${attempt}`);
    // Re-attach fresh token on each reconnect attempt
    const freshToken = localStorage.getItem('token');
    if (freshToken) socket.auth = { token: freshToken };
  });

  socket.on('reconnect_failed', () => {
    console.error('Socket reconnection failed after all attempts');
  });

  socket.on('duplicate-session', ({ message }) => {
    console.warn('Duplicate session detected:', message);
    // Dispatch a custom event so UI components can react
    window.dispatchEvent(new CustomEvent('duplicate-session', { detail: { message } }));
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export default { connectSocket, disconnectSocket, getSocket };
