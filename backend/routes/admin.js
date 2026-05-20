const express = require('express');
const { getDashboard, syncRoomParticipants } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard', getDashboard);
router.post('/sync-rooms', syncRoomParticipants);

module.exports = router;
