import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import useRoomStore from '../store/roomStore';

const useSocket = ({ roomId } = {}) => {
  const socket = getSocket();
  const joinedRef = useRef(false);
  const {
    addMessage,
    setMessageHistory,
    setParticipants,
    addTypingUser,
    removeTypingUser,
    incrementUnread,
    currentRoom
  } = useRoomStore();

  const joinRoom = useCallback(() => {
    if (socket && roomId && !joinedRef.current) {
      joinedRef.current = true;
      socket.emit('join-room', { roomId });
    }
  }, [socket, roomId]);

  const leaveRoom = useCallback(() => {
    if (socket && roomId) {
      joinedRef.current = false;
      socket.emit('leave-room', { roomId });
    }
  }, [socket, roomId]);

  const sendMessage = useCallback((content) => {
    if (socket && roomId && content.trim()) {
      socket.emit('message', { roomId, content });
    }
  }, [socket, roomId]);

  const sendTyping = useCallback((isTyping) => {
    if (socket && roomId) socket.emit('typing', { roomId, isTyping });
  }, [socket, roomId]);

  const muteUser = useCallback((targetUserId) => {
    if (socket && roomId) socket.emit('mute-user', { targetUserId, roomId });
  }, [socket, roomId]);

  const kickUser = useCallback((targetUserId) => {
    if (socket && roomId) socket.emit('kick-user', { targetUserId, roomId });
  }, [socket, roomId]);

  const toggleRoomLock = useCallback((isLocked) => {
    if (socket && roomId) socket.emit('toggle-room-lock', { roomId, isLocked });
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;

    const handleMessage = (msg) => {
      addMessage(msg);
      // If the message is for a different room than the one currently open, increment unread
      if (msg.roomId && msg.roomId !== currentRoom?._id) {
        incrementUnread(msg.roomId);
      }
    };

    const handlers = {
      'message': handleMessage,
      'system-message': (msg) => addMessage({ ...msg, type: 'system', senderName: 'System' }),
      'message-history': ({ messages }) => setMessageHistory(messages),
      'room-participants': ({ participants }) => setParticipants(participants),
      'typing': ({ username, isTyping }) => {
        isTyping ? addTypingUser(username) : removeTypingUser(username);
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

    return () => {
      Object.keys(handlers).forEach((event) => socket.off(event, handlers[event]));
    };
  }, [socket, roomId, addMessage, setMessageHistory, setParticipants, addTypingUser, removeTypingUser, incrementUnread, currentRoom]);

  return { joinRoom, leaveRoom, sendMessage, sendTyping, muteUser, kickUser, toggleRoomLock };
};

export default useSocket;
