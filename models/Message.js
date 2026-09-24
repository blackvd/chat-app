const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
}, { timestamps: true });

// Support fetching a room's message history in chronological order.
messageSchema.index({ chatRoom: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);
