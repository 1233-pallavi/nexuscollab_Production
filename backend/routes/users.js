const express = require('express');
const { getUsers, getActiveUsers, createUser, updateUserRole, deactivateUser, activateUser, updateProfile, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Any authenticated user can get the active user list (needed for room participant management)
router.get('/active', getActiveUsers);

// Admin/moderator: full user list with all details
router.get('/', authorize('admin', 'moderator'), getUsers);

router.post('/', authorize('admin'), createUser);
router.patch('/profile', updateProfile);
router.patch('/:id/role', authorize('admin'), updateUserRole);
router.patch('/:id/activate', authorize('admin'), activateUser);
router.delete('/:id/deactivate', authorize('admin'), deactivateUser);   // soft delete
router.delete('/:id', authorize('admin'), deleteUser);                   // hard delete

module.exports = router;
