const express = require('express');
const mongoose = require('mongoose');
const ChatRoom = require('../models/ChatRoom');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

function roomName(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  return name && name.length <= 100 ? name : null;
}

router.get('/', async (req, res) => {
  const { page = '1', limit = '20' } = req.query;
  if (typeof page !== 'string' || typeof limit !== 'string'
      || !/^[1-9]\d*$/.test(page) || !/^[1-9]\d*$/.test(limit)
      || Number(page) > 10000 || Number(limit) > 100) {
    return res.status(400).json({ error: 'Use page 1–10000 and limit 1–100.' });
  }
  const rooms = await ChatRoom.find({}).sort({ _id: -1 })
    .skip((Number(page) - 1) * Number(limit)).limit(Number(limit))
    .select('name createdBy createdAt updatedAt members').lean();
  res.json({
    rooms: rooms.map(({ members, ...room }) => ({
      ...room,
      isMember: members.some((member) => String(member) === String(req.userId)),
    })),
    page: Number(page), limit: Number(limit),
  });
});

router.post('/', async (req, res) => {
  const name = roomName(req.body);
  if (!name) {
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

router.get('/:roomId', async (req, res) => {
  const room = await ChatRoom.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Chat room not found.' });
  res.json({ room });
});

async function ownerFailure(roomId, res) {
  const exists = await ChatRoom.exists({ _id: roomId });
  return res.status(exists ? 403 : 404).json({
    error: exists ? 'Only the room creator can perform this operation.' : 'Chat room not found.',
  });
}

router.patch('/:roomId', async (req, res) => {
  const name = roomName(req.body);
  if (!name) return res.status(400).json({ error: 'Provide a room name between 1 and 100 characters.' });
  const room = await ChatRoom.findOneAndUpdate(
    { _id: req.params.roomId, createdBy: req.userId },
    { $set: { name } }, { new: true, runValidators: true },
  );
  if (!room) return ownerFailure(req.params.roomId, res);
  res.json({ room });
});

router.delete('/:roomId', async (req, res) => {
  const room = await ChatRoom.findOneAndDelete({ _id: req.params.roomId, createdBy: req.userId });
  if (!room) return ownerFailure(req.params.roomId, res);
  res.sendStatus(204);
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
