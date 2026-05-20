const Room = require('../models/Room');
const ActivityLog = require('../models/ActivityLog');

/**
 * Get all rooms visible to a given user based on their role.
 * - admin: all rooms
 * - moderator/user: only rooms they are a participant of
 */
const getRoomsForUser = async (user) => {
  const filter = user.role === 'admin' ? {} : { participants: user._id };

  return Room.find(filter)
    .populate('createdBy', 'username')
    .populate('participants', 'username isOnline')
    .select('-messages')
    .sort({ updatedAt: -1 });
};

/**
 * Create a room, add creator as participant, add all admins, and log the activity.
 */
const createRoom = async ({ name, description, isPrivate, allowedRoles, maxParticipants, createdBy }) => {
  const room = await Room.create({
    name,
    description,
    isPrivate: isPrivate || false,
    allowedRoles: allowedRoles || ['user', 'moderator', 'admin'],
    maxParticipants: maxParticipants || 50,
    createdBy: createdBy._id,
    participants: [createdBy._id]
  });

  await ActivityLog.create({
    type: 'room_created',
    user: createdBy._id,
    username: createdBy.username,
    room: room._id,
    roomName: room.name
  });

  return room.populate('createdBy', 'username email role');
};

/**
 * Check whether a user is allowed to join a room.
 * Returns { allowed: bool, reason: string }
 */
const canUserJoinRoom = (room, user) => {
  if (user.role === 'admin') return { allowed: true };

  if (room.isLocked && user.role === 'user') {
    return { allowed: false, reason: 'Room is locked' };
  }

  // Must be a participant to join
  const isMember = room.participants.some(
    (p) => p._id?.toString() === user._id.toString() || p.toString() === user._id.toString()
  );
  if (!isMember) return { allowed: false, reason: 'You are not assigned to this room' };

  return { allowed: true };
};

/**
 * Check whether screen sharing is allowed for a user in a room.
 */
const canUserShareScreen = (room, user) => {
  if (['admin', 'moderator'].includes(user.role)) return true;
  return room.screenSharingEnabled === true;
};

module.exports = { getRoomsForUser, createRoom, canUserJoinRoom, canUserShareScreen };
