const express = require('express');
const mongoose = require('mongoose');
const ChatRoom = require('../models/ChatRoom');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

router.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Provide a room name between 1 and 100 characters.' });
  }
  const room = await ChatRoom.create({
    name,
    createdBy: req.userId,
    members: [req.userId],
  });
  res.status(201).json({ room });
});

router.param('roomId', (req, res, next, roomId) => {
  if (!mongoose.isObjectIdOrHexString(roomId)) {
    return res.status(400).json({ error: 'Invalid room ID.' });
  }
  next();
});

router.post('/:roomId/join', async (req, res) => {
  const room = await ChatRoom.findByIdAndUpdate(req.params.roomId,
    { $addToSet: { members: req.userId } }, { new: true });
  if (!room) return res.status(404).json({ error: 'Chat room not found.' });
  res.json({ room });
});

router.post('/:roomId/leave', async (req, res) => {
  const room = await ChatRoom.findByIdAndUpdate(req.params.roomId,
    { $pull: { members: req.userId } }, { new: true });
  if (!room) return res.status(404).json({ error: 'Chat room not found.' });
  res.json({ room });
});

module.exports = router;
