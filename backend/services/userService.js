const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

/**
 * Update a user's role and log the activity.
 */
const updateUserRole = async (targetUserId, newRole, performedBy) => {
  const user = await User.findByIdAndUpdate(
    targetUserId,
    { role: newRole },
    { new: true }
  ).select('-password');

  if (!user) return null;

  await ActivityLog.create({
    type: 'role_change',
    user: performedBy._id,
    username: performedBy.username,
    details: `Changed role of ${user.username} to ${newRole}`
  });

  return user;
};

/**
 * Deactivate a user account.
 */
const deactivateUser = async (targetUserId, performedBy) => {
  const user = await User.findByIdAndUpdate(
    targetUserId,
    { isActive: false },
    { new: true }
  ).select('-password');

  if (!user) return null;

  await ActivityLog.create({
    type: 'user_deactivated',
    user: performedBy._id,
    username: performedBy.username,
    details: `Deactivated user ${user.username}`
  });

  return user;
};

/**
 * Get all active users.
 */
const getAllUsers = async () => {
  return User.find({ isActive: true })
    .select('-password')
    .sort({ createdAt: -1 });
};

module.exports = { updateUserRole, deactivateUser, getAllUsers };
