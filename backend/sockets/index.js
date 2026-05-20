const { authenticateSocket } = require('../middleware/auth');
const Room = require('../models/Room');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { canUserJoinRoom, canUserShareScreen } = require('../services/roomService');

// Track active sessions: userId -> Set of socketIds
const activeSessions = new Map();
// Track room participants: roomId -> Map(userId -> socketId)
const roomParticipants = new Map();
// Track duplicate session detection: userId -> primary socketId
const primarySessions = new Map();

const initializeSockets = (io) => {
  // Authenticate all socket connections
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`✅ ${user.username} connected [${socket.id}]`);

    // Track sessions
    if (!activeSessions.has(user._id.toString())) {
      activeSessions.set(user._id.toString(), new Set());
    }
    activeSessions.get(user._id.toString()).add(socket.id);

    // Duplicate session detection — notify existing sessions
    if (primarySessions.has(user._id.toString())) {
      const existingSocketId = primarySessions.get(user._id.toString());
      io.to(existingSocketId).emit('duplicate-session', {
        message: 'You have connected from another tab or device.'
      });
    }
    primarySessions.set(user._id.toString(), socket.id);

    // Mark online
    await User.findByIdAndUpdate(user._id, { isOnline: true });

    // Broadcast online status to all
    io.emit('user-status', { userId: user._id, username: user.username, isOnline: true });

    // ─── ROOM EVENTS ──────────────────────────────────────────────────────────

    socket.on('join-room', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId).populate('participants', '_id');
        if (!room) return socket.emit('error', { message: 'Room not found' });

        // Room owner and admins can always join
        const isOwner = room.createdBy?.toString() === user._id.toString();
        if (!isOwner && user.role !== 'admin') {
          const { allowed, reason } = canUserJoinRoom(room, user);
          if (!allowed) return socket.emit('error', { message: reason });
        }

        socket.join(roomId);

        // Update activeParticipants
        await Room.findByIdAndUpdate(roomId, {
          $pull: { activeParticipants: { userId: user._id } }
        });
        await Room.findByIdAndUpdate(roomId, {
          $push: {
            activeParticipants: {
              userId: user._id,
              socketId: socket.id,
              username: user.username,
              joinedAt: new Date()
            }
          }
        });

        // Update in-memory map
        if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Map());
        roomParticipants.get(roomId).set(user._id.toString(), socket.id);

        socket.data.currentRoom = roomId;

        // Get updated room
        const updatedRoom = await Room.findById(roomId)
          .populate('activeParticipants.userId', 'username role avatar');

        // Notify everyone in room
        io.to(roomId).emit('room-participants', {
          roomId,
          participants: updatedRoom.activeParticipants
        });

        // Notify new user joined
        socket.to(roomId).emit('user-joined', {
          userId: user._id,
          username: user.username,
          role: user.role,
          socketId: socket.id
        });

        // Send recent messages to joining user
        const roomWithMessages = await Room.findById(roomId)
          .populate('messages.sender', 'username')
          .select('messages');
        socket.emit('message-history', {
          messages: roomWithMessages.messages.slice(-50)
        });

        await ActivityLog.create({
          type: 'join_room',
          user: user._id,
          username: user.username,
          room: roomId,
          roomName: room.name
        });

        // System message
        io.to(roomId).emit('system-message', {
          content: `${user.username} joined the room`,
          timestamp: new Date()
        });

      } catch (err) {
        console.error('join-room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave-room', async ({ roomId }) => {
      await handleLeaveRoom(socket, roomId, io, user);
    });

    // ─── CHAT EVENTS ──────────────────────────────────────────────────────────

    socket.on('message', async ({ roomId, content }) => {
      try {
        if (!content || content.trim().length === 0) return;
        if (content.length > 2000) return socket.emit('error', { message: 'Message too long' });

        const sanitized = content.trim().replace(/<[^>]*>/g, ''); // basic sanitization

        const message = {
          sender: user._id,
          senderName: user.username,
          content: sanitized,
          timestamp: new Date(),
          type: 'text'
        };

        await Room.findByIdAndUpdate(roomId, {
          $push: { messages: message }
        });

        io.to(roomId).emit('message', {
          ...message,
          sender: { _id: user._id, username: user.username }
        });
      } catch (err) {
        console.error('message error:', err);
      }
    });

    socket.on('typing', ({ roomId, isTyping }) => {
      socket.to(roomId).emit('typing', {
        userId: user._id,
        username: user.username,
        isTyping
      });
    });

    // ─── WEBRTC SIGNALING ────────────────────────────────────────────────────

    socket.on('call-start', async ({ roomId }) => {
      await Room.findByIdAndUpdate(roomId, {
        'activeCall.isActive': true,
        'activeCall.startedAt': new Date()
      });

      socket.to(roomId).emit('call-started', {
        roomId,
        initiator: { userId: user._id, username: user.username, socketId: socket.id }
      });

      await ActivityLog.create({
        type: 'call_start',
        user: user._id,
        username: user.username,
        room: roomId
      });
    });

    socket.on('call-end', async ({ roomId }) => {
      await Room.findByIdAndUpdate(roomId, {
        'activeCall.isActive': false
      });
      io.to(roomId).emit('call-ended', { roomId });
    });

    socket.on('offer', ({ targetSocketId, offer, roomId }) => {
      io.to(targetSocketId).emit('offer', {
        offer,
        fromSocketId: socket.id,
        fromUserId: user._id,
        fromUsername: user.username,
        roomId
      });
    });

    socket.on('answer', ({ targetSocketId, answer }) => {
      io.to(targetSocketId).emit('answer', {
        answer,
        fromSocketId: socket.id
      });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate,
        fromSocketId: socket.id
      });
    });

    socket.on('call-join', ({ roomId }) => {
      socket.to(roomId).emit('peer-joined-call', {
        socketId: socket.id,
        userId: user._id,
        username: user.username
      });
    });

    socket.on('call-leave', ({ roomId }) => {
      socket.to(roomId).emit('peer-left-call', {
        socketId: socket.id,
        userId: user._id
      });
    });

    // ─── SCREEN SHARING ───────────────────────────────────────────────────────

    socket.on('screen-share-start', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return socket.emit('error', { message: 'Room not found' });

        if (!canUserShareScreen(room, user)) {
          return socket.emit('error', { message: 'Screen sharing is disabled in this room' });
        }

        socket.to(roomId).emit('screen-share-started', {
          userId: user._id,
          username: user.username,
          socketId: socket.id
        });
        ActivityLog.create({ type: 'screen_share', user: user._id, username: user.username, room: roomId });
      } catch (err) {
        console.error('screen-share-start error:', err);
      }
    });

    socket.on('screen-share-stop', ({ roomId }) => {
      socket.to(roomId).emit('screen-share-stopped', {
        userId: user._id,
        socketId: socket.id
      });
    });

    // ─── MODERATOR EVENTS ─────────────────────────────────────────────────────

    socket.on('mute-user', async ({ targetUserId, roomId }) => {
      if (!['admin', 'moderator'].includes(user.role)) return;

      const targetSockets = activeSessions.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('you-are-muted', { by: user.username, roomId });
        });
      }

      io.to(roomId).emit('user-muted', {
        targetUserId,
        by: user.username
      });

      await ActivityLog.create({
        type: 'user_muted',
        user: user._id,
        username: user.username,
        room: roomId,
        details: `Muted user ${targetUserId}`
      });
    });

    socket.on('kick-user', async ({ targetUserId, roomId }) => {
      if (!['admin', 'moderator'].includes(user.role)) return;

      // Moderator cannot kick an admin
      if (user.role === 'moderator') {
        const targetUser = await User.findById(targetUserId).select('role');
        if (targetUser?.role === 'admin') return;
      }

      const targetSockets = activeSessions.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('you-are-kicked', { by: user.username, roomId });
        });
      }

      // Remove from room
      await Room.findByIdAndUpdate(roomId, {
        $pull: { activeParticipants: { userId: targetUserId } }
      });

      io.to(roomId).emit('user-kicked', { targetUserId, by: user.username });

      await ActivityLog.create({
        type: 'user_kicked',
        user: user._id,
        username: user.username,
        room: roomId,
        details: `Kicked user ${targetUserId}`
      });
    });

    socket.on('toggle-room-lock', async ({ roomId, isLocked }) => {
      if (!['admin', 'moderator'].includes(user.role)) return;
      await Room.findByIdAndUpdate(roomId, { isLocked });
      io.to(roomId).emit('room-locked', { isLocked, by: user.username });
    });

    socket.on('toggle-screen-sharing', async ({ roomId, enabled }) => {
      if (!['admin', 'moderator'].includes(user.role)) return;
      await Room.findByIdAndUpdate(roomId, { screenSharingEnabled: enabled });
      io.to(roomId).emit('screen-sharing-toggled', { enabled, by: user.username });
    });

    // ─── DISCONNECT ───────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      console.log(`❌ ${user.username} disconnected [${socket.id}]`);

      // Remove from session tracking
      const sessions = activeSessions.get(user._id.toString());
      if (sessions) {
        sessions.delete(socket.id);
        if (sessions.size === 0) {
          activeSessions.delete(user._id.toString());
          await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen: new Date() });
          io.emit('user-status', { userId: user._id, isOnline: false });

          await ActivityLog.create({
            type: 'logout',
            user: user._id,
            username: user.username,
            details: 'Disconnected'
          });
        }
      }

      // Clean up primary session pointer if this was the primary socket
      if (primarySessions.get(user._id.toString()) === socket.id) {
        primarySessions.delete(user._id.toString());
      }

      // Leave current room
      if (socket.data.currentRoom) {
        await handleLeaveRoom(socket, socket.data.currentRoom, io, user);
      }
    });
  });
};

const handleLeaveRoom = async (socket, roomId, io, user) => {
  try {
    socket.leave(roomId);

    await Room.findByIdAndUpdate(roomId, {
      $pull: { activeParticipants: { userId: user._id } }
    });

    if (roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(user._id.toString());
    }

    const updatedRoom = await Room.findById(roomId)
      .populate('activeParticipants.userId', 'username role');

    if (updatedRoom) {
      io.to(roomId).emit('room-participants', {
        roomId,
        participants: updatedRoom.activeParticipants
      });

      io.to(roomId).emit('user-left', {
        userId: user._id,
        username: user.username,
        socketId: socket.id
      });

      io.to(roomId).emit('system-message', {
        content: `${user.username} left the room`,
        timestamp: new Date()
      });

      // Notify peers in call
      io.to(roomId).emit('peer-left-call', {
        socketId: socket.id,
        userId: user._id
      });
    }

    await ActivityLog.create({
      type: 'leave_room',
      user: user._id,
      username: user.username,
      room: roomId
    });
  } catch (err) {
    console.error('leave-room error:', err);
  }
};

module.exports = { initializeSockets };
