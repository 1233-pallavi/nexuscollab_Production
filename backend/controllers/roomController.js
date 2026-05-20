const Room = require('../models/Room');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const createRoom = async (req, res) => {
  try {
    const { name, description, isPrivate, allowedRoles, maxParticipants } = req.body;

    // Sanitize inputs
    const cleanName = (name || '').trim().replace(/<[^>]*>/g, '');
    const cleanDesc = (description || '').trim().replace(/<[^>]*>/g, '');

    if (!cleanName) return res.status(400).json({ error: 'Room name is required' });

    // Creator is always added as a participant
    const room = await Room.create({
      name: cleanName,
      description: cleanDesc,
      isPrivate: isPrivate || false,
      allowedRoles: allowedRoles || ['user', 'moderator', 'admin'],
      maxParticipants: maxParticipants || 50,
      createdBy: req.user._id,
      participants: [req.user._id]
    });

    // Add room to creator's assignedRooms
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { assignedRooms: room._id }
    });

    // If creator is not admin, also add all admins to the room automatically
    if (req.user.role !== 'admin') {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      const adminIds = admins.map(a => a._id);
      if (adminIds.length > 0) {
        await Room.findByIdAndUpdate(room._id, {
          $addToSet: { participants: { $each: adminIds } }
        });
        await User.updateMany(
          { role: 'admin', isActive: true },
          { $addToSet: { assignedRooms: room._id } }
        );
      }
    } else {
      // Creator is admin — add all other admins too
      const otherAdmins = await User.find({ role: 'admin', isActive: true, _id: { $ne: req.user._id } }).select('_id');
      if (otherAdmins.length > 0) {
        const adminIds = otherAdmins.map(a => a._id);
        await Room.findByIdAndUpdate(room._id, {
          $addToSet: { participants: { $each: adminIds } }
        });
        await User.updateMany(
          { role: 'admin', isActive: true, _id: { $ne: req.user._id } },
          { $addToSet: { assignedRooms: room._id } }
        );
      }
    }

    await ActivityLog.create({
      type: 'room_created',
      user: req.user._id,
      username: req.user.username,
      room: room._id,
      roomName: room.name
    });

    const populated = await Room.findById(room._id).populate('createdBy', 'username email role');
    res.status(201).json({ room: populated });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
};

const getRooms = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'admin') {
      // Admin sees all rooms
      filter = {};
    } else {
      // Moderator and user see only rooms they are assigned to (participants list)
      filter = { participants: req.user._id };
    }

    const rooms = await Room.find(filter)
      .populate('createdBy', 'username')
      .populate('participants', 'username isOnline')
      .select('-messages')
      .sort({ updatedAt: -1 });

    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
};

const getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('createdBy', 'username email')
      .populate('participants', 'username isOnline role')
      .populate('messages.sender', 'username');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Check access: admin can always access; others must be a participant
    if (req.user.role !== 'admin' && !room.participants.some(p => p._id.equals(req.user._id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (req.user.role !== 'admin' && !room.createdBy.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized to delete this room' });
    }

    // Remove this room from every participant's assignedRooms
    await User.updateMany(
      { assignedRooms: room._id },
      { $pull: { assignedRooms: room._id } }
    );

    await ActivityLog.create({
      type: 'room_deleted',
      user: req.user._id,
      username: req.user.username,
      roomName: room.name
    });

    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { name, description, isLocked, screenSharingEnabled, allowedRoles } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim().replace(/<[^>]*>/g, '');
    if (description !== undefined) updates.description = description.trim().replace(/<[^>]*>/g, '');
    if (isLocked !== undefined) updates.isLocked = isLocked;
    if (screenSharingEnabled !== undefined) updates.screenSharingEnabled = screenSharingEnabled;
    if (allowedRoles !== undefined) updates.allowedRoles = allowedRoles;

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update room' });
  }
};

// Add a user to room participants (admin/moderator/room owner only)
const addParticipant = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Check permission: admin, moderator, or room owner
    const roomCheck = await Room.findById(req.params.id).select('createdBy');
    if (!roomCheck) return res.status(404).json({ error: 'Room not found' });
    const isOwner = roomCheck.createdBy?.toString() === req.user._id.toString();
    if (!['admin', 'moderator'].includes(req.user.role) && !isOwner) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { participants: userId } },
      { new: true }
    ).populate('participants', 'username email role isOnline');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Sync assignedRooms on the user
    await User.findByIdAndUpdate(userId, {
      $addToSet: { assignedRooms: req.params.id }
    });

    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add participant' });
  }
};

// Remove a user from room participants (admin/moderator/room owner only)
const removeParticipant = async (req, res) => {
  try {
    // Check permission: admin, moderator, or room owner
    const roomCheck = await Room.findById(req.params.id).select('createdBy');
    if (!roomCheck) return res.status(404).json({ error: 'Room not found' });
    const isOwner = roomCheck.createdBy?.toString() === req.user._id.toString();
    if (!['admin', 'moderator'].includes(req.user.role) && !isOwner) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Moderator cannot remove an admin
    if (req.user.role === 'moderator') {
      const targetUser = await User.findById(req.params.userId).select('role');
      if (targetUser?.role === 'admin') {
        return res.status(403).json({ error: 'Moderators cannot remove admins from rooms' });
      }
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $pull: { participants: req.params.userId } },
      { new: true }
    ).populate('participants', 'username email role isOnline');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Sync assignedRooms on the user
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { assignedRooms: req.params.id }
    });

    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove participant' });
  }
};

module.exports = { createRoom, getRooms, getRoom, deleteRoom, updateRoom, addParticipant, removeParticipant };
