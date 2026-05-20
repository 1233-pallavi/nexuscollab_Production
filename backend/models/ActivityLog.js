const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'login', 'logout',
      'join_room', 'leave_room',
      'call_start', 'call_end',
      'user_kicked', 'user_muted',
      'room_created', 'room_deleted',
      'screen_share',
      'user_created', 'user_deactivated', 'user_activated', 'role_change'
    ],
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  username: String,
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  roomName: String,
  details: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: false });

// Auto-expire logs after 30 days
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
