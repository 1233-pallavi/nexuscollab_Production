const express = require('express');
const { createRoom, getRooms, getRoom, deleteRoom, updateRoom, addParticipant, removeParticipant } = require('../controllers/roomController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getRooms);
router.get('/:id', getRoom);
router.post('/', authorize('admin', 'moderator'), createRoom);
router.patch('/:id', authorize('admin', 'moderator'), updateRoom);
router.delete('/:id', authorize('admin', 'moderator'), deleteRoom);

// Participant management: admin, moderator, OR room owner (checked in controller)
router.post('/:id/participants', addParticipant);
router.delete('/:id/participants/:userId', removeParticipant);

module.exports = router;
