const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

// Get ALL users (active + inactive) for admin view
const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get active users only — accessible by any authenticated user (for room management)
const getActiveUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('_id username role isOnline avatar')
      .sort({ username: 1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Admin creates a new user account directly
const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const assignedRole = ['user', 'moderator', 'admin'].includes(role) ? role : 'user';
    const user = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole
    });

    await ActivityLog.create({
      type: 'user_created',
      user: req.user._id,
      username: req.user.username,
      details: `Admin created user ${username} with role ${assignedRole}`
    });

    res.status(201).json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isOnline: user.isOnline,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error.message);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ error: `${field} already exists` });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors)[0].message;
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    await ActivityLog.create({
      type: 'role_change',
      user: req.user._id,
      username: req.user.username,
      details: `Changed role of ${user.username} to ${role}`
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
};

const deactivateUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    await ActivityLog.create({
      type: 'user_deactivated',
      user: req.user._id,
      username: req.user.username,
      details: `Deactivated user ${user.username}`
    });

    res.json({ message: 'User deactivated', user });
  } catch (error) {
    console.error('Deactivate user error:', error.message);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });

    await ActivityLog.create({
      type: 'user_activated',
      user: req.user._id,
      username: req.user.username,
      details: `Activated user ${user.username}`
    });

    res.json({ message: 'User activated', user });
  } catch (error) {
    console.error('Activate user error:', error.message);
    res.status(500).json({ error: 'Failed to activate user' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const updates = {};
    if (username) updates.username = username;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Hard delete — permanently removes user and cleans up room assignments
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Remove user from all room participants and assignedRooms
    const Room = require('../models/Room');
    await Room.updateMany(
      { participants: user._id },
      { $pull: { participants: user._id, activeParticipants: { userId: user._id } } }
    );

    await ActivityLog.create({
      type: 'user_deactivated',
      user: req.user._id,
      username: req.user.username,
      details: `Permanently deleted user ${user.username}`
    });

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: `User ${user.username} permanently deleted` });
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = { getUsers, getActiveUsers, createUser, updateUserRole, deactivateUser, activateUser, updateProfile, deleteUser };
