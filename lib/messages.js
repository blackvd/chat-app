const mongoose = require('mongoose');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');

function attachMessages(io, socket, authenticate) {
  socket.on('message:send', async (payload, acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    const roomId = payload?.roomId;
    const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
    if (!mongoose.isObjectIdOrHexString(roomId) || !content || content.length > 5000) {
      return reply({ ok: false, error: 'Provide a valid room ID and message of 1–5000 characters.' });
    }
    try {
      await authenticate(socket);
    } catch {
      reply({ ok: false, error: 'Log in to send messages.' });
      socket.disconnect(true);
      return;
    }
    try {
      const room = await ChatRoom.findOne({ _id: roomId, members: socket.request.userId });
      if (!room) return reply({ ok: false, error: 'Join this room before sending messages.' });
      const saved = await Message.create({ chatRoom: roomId, sender: socket.request.userId, content });
      const message = {
        _id: String(saved._id), chatRoom: String(saved.chatRoom),
        sender: socket.data.user, content: saved.content, createdAt: saved.createdAt,
      };
      // Check current membership and session for every recipient, including other tabs.
      await Promise.all([...io.sockets.sockets.values()].map(async (recipient) => {
        try {
          await authenticate(recipient);
          const member = await ChatRoom.exists({ _id: roomId, members: recipient.request.userId });
          if (member && recipient.connected) recipient.emit('message:new', message);
        } catch {
          recipient.disconnect(true);
        }
      }));
      reply({ ok: true, message });
    } catch (err) {
      console.error('Unable to send message:', err.name);
      reply({ ok: false, error: 'Unable to send the message. Please try again.' });
    }
  });
}

module.exports = { attachMessages };
