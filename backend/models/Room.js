const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: String,
  content: {
    type: String,
    required: true,
    maxlength: [2000, 'Message too long']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['text', 'system', 'file'],
    default: 'text'
  }
});

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    maxlength: [50, 'Room name too long']
  },
  description: {
    type: String,
    maxlength: [200, 'Description too long'],
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  activeParticipants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    socketId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  messages: [messageSchema],
  isLocked: {
    type: Boolean,
    default: false
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  allowedRoles: {
    type: [String],
    enum: ['user', 'moderator', 'admin'],
    default: ['user', 'moderator', 'admin']
  },
  screenSharingEnabled: {
    type: Boolean,
    default: true
  },
  activeCall: {
    isActive: { type: Boolean, default: false },
    startedAt: Date,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  maxParticipants: {
    type: Number,
    default: 50
  }
}, { timestamps: true });

module.exports = mongoose.model('Room', roomSchema);
