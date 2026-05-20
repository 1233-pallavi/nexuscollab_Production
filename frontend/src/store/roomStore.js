import { create } from 'zustand';
import { roomsAPI } from '../services/api';

const useRoomStore = create((set, get) => ({
  rooms: [],
  currentRoom: null,
  participants: [],
  messages: [],
  typingUsers: [],
  unreadCounts: {}, // roomId -> number
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true });
    try {
      const { data } = await roomsAPI.getAll();
      set({ rooms: data.rooms, isLoading: false });
    } catch (err) {
      set({ error: 'Failed to fetch rooms', isLoading: false });
    }
  },

  fetchRoom: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await roomsAPI.getOne(id);
      set({ currentRoom: data.room, messages: data.room.messages || [], isLoading: false });
    } catch {
      set({ error: 'Failed to fetch room', isLoading: false });
    }
  },

  createRoom: async (roomData) => {
    try {
      const { data } = await roomsAPI.create(roomData);
      set((state) => ({ rooms: [data.room, ...state.rooms] }));
      return { success: true, room: data.room };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to create room';
      return { success: false, error: message };
    }
  },

  deleteRoom: async (id) => {
    try {
      await roomsAPI.delete(id);
      set((state) => ({ rooms: state.rooms.filter((r) => r._id !== id) }));
      return { success: true };
    } catch {
      return { success: false };
    }
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),
  setParticipants: (participants) => set({ participants }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setMessageHistory: (messages) => set((state) => {
    // Only replace if we have no messages yet (avoid overwriting REST-loaded history)
    if (state.messages.length === 0) {
      return { messages };
    }
    // Merge: keep existing messages, add any new ones from socket history not already present
    const existingIds = new Set(state.messages.map(m => m._id?.toString()).filter(Boolean));
    const newMsgs = messages.filter(m => !m._id || !existingIds.has(m._id.toString()));
    return { messages: [...state.messages, ...newMsgs] };
  }),

  // Increment unread count for a room (called when a message arrives and user is not in that room)
  incrementUnread: (roomId) => set((state) => ({
    unreadCounts: {
      ...state.unreadCounts,
      [roomId]: (state.unreadCounts[roomId] || 0) + 1
    }
  })),

  // Clear unread count when user opens the room
  clearUnread: (roomId) => set((state) => ({
    unreadCounts: { ...state.unreadCounts, [roomId]: 0 }
  })),

  addTypingUser: (username) => set((state) => ({
    typingUsers: state.typingUsers.includes(username)
      ? state.typingUsers
      : [...state.typingUsers, username]
  })),

  removeTypingUser: (username) => set((state) => ({
    typingUsers: state.typingUsers.filter((u) => u !== username)
  })),

  clearRoom: () => set({ currentRoom: null, participants: [], messages: [], typingUsers: [] })
}));

export default useRoomStore;
