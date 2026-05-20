const User = require('../models/User');
const Room = require('../models/Room');
const ActivityLog = require('../models/ActivityLog');

const getDashboard = async (req, res) => {
  try {
    const [totalUsers, totalRooms, onlineUsers] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Room.countDocuments(),
      User.countDocuments({ isOnline: true })
    ]);

    // Recent activity logs
    const recentLogs = await ActivityLog.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    // Active rooms — populate activeParticipants with user details for session monitoring
    const activeRooms = await Room.find({ 'activeParticipants.0': { $exists: true } })
      .select('name activeParticipants activeCall')
      .populate('activeParticipants.userId', 'username role')
      .lean();

    const activeCalls = activeRooms.filter(r => r.activeCall?.isActive).length;

    // All rooms for the admin rooms management table
    const allRooms = await Room.find({})
      .select('name description createdBy isPrivate isLocked participants createdAt')
      .populate('createdBy', 'username')
      .lean();

    // Online users with their current room (if any)
    const onlineUserList = await User.find({ isOnline: true, isActive: true })
      .select('username role lastSeen')
      .lean();

    // Build a map: userId -> roomName for users currently in a room
    const userRoomMap = {};
    for (const room of activeRooms) {
      for (const ap of room.activeParticipants) {
        const uid = ap.userId?._id?.toString() || ap.userId?.toString();
        if (uid) userRoomMap[uid] = room.name;
      }
    }

    const onlineSessions = onlineUserList.map(u => ({
      ...u,
      currentRoom: userRoomMap[u._id.toString()] || null
    }));

    res.json({
      stats: {
        totalUsers,
        totalRooms,
        onlineUsers,
        activeRooms: activeRooms.length,
        activeCalls
      },
      recentActivity: recentLogs,
      activeRooms,
      allRooms,
      onlineSessions
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// One-time migration: ensure all admins are participants in every room
const syncRoomParticipants = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    const adminIds = admins.map(a => a._id);
    const rooms = await Room.find({}).select('_id createdBy');

    for (const room of rooms) {
      await Room.findByIdAndUpdate(room._id, {
        $addToSet: { participants: room.createdBy }
      });
      await User.findByIdAndUpdate(room.createdBy, {
        $addToSet: { assignedRooms: room._id }
      });

      if (adminIds.length > 0) {
        await Room.findByIdAndUpdate(room._id, {
          $addToSet: { participants: { $each: adminIds } }
        });
        await User.updateMany(
          { role: 'admin', isActive: true },
          { $addToSet: { assignedRooms: room._id } }
        );
      }
    }

    res.json({ message: `Synced ${rooms.length} rooms` });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
};

module.exports = { getDashboard, syncRoomParticipants };
