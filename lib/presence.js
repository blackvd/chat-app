const requireAuth = require('../middleware/requireAuth');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const { attachMessages } = require('./messages');

function authenticate(socket) {
  return new Promise((resolve, reject) => {
    const res = { status() { return this; }, json() { reject(new Error('Authentication required')); } };
    Promise.resolve(requireAuth(socket.request, res, resolve)).catch(reject);
  });
}

function roomPresence(rooms, users) {
  const online = new Map(users.map((user) => [String(user.id), user]));
  return Object.fromEntries(rooms.map((room) => [String(room._id),
    [...new Set(room.members.map(String))].filter((id) => online.has(id)).map((id) => online.get(id)),
  ]));
}

function attachPresence(io, app) {
  let running = false;
  let dirty = false;
  let closed = false;

  async function refresh() {
    dirty = true;
    if (running || closed) return;
    running = true;
    try {
      while (dirty && !closed) {
        dirty = false;
        const users = [];
        for (const socket of io.sockets.sockets.values()) {
          try {
            await authenticate(socket);
            if (socket.connected) users.push(socket.data.user);
          } catch {
            socket.disconnect(true);
          }
        }
        const rooms = users.length ? await ChatRoom.find({ members: { $in: users.map((user) => user.id) } })
          .select('members').lean() : [];
        // A membership change during the query requires a fresh snapshot.
        if (!dirty && !closed) io.emit('rooms:presence', roomPresence(rooms, users));
      }
    } catch (err) {
      console.error('Unable to update room presence:', err.name);
      io.emit('rooms:presence-error');
    } finally {
      running = false;
    }
  }

  io.use(async (socket, next) => {
    try {
      await authenticate(socket);
      const user = await User.findById(socket.request.userId).select('username').lean();
      if (!user) return next(new Error('Authentication required'));
      socket.data.user = { id: String(user._id), username: user.username };
      next();
    } catch {
      next(new Error('Authentication required'));
    }
  });
  io.on('connection', (socket) => {
    attachMessages(io, socket, authenticate);
    socket.on('disconnect', refresh);
    refresh();
  });
  // Recheck expired/revoked sessions even when no room operations occur.
  const timer = setInterval(refresh, 30000);
  timer.unref();
  app.locals.refreshPresence = refresh;
  io.httpServer.on('close', () => {
    closed = true;
    clearInterval(timer);
    delete app.locals.refreshPresence;
  });
  return io;
}

module.exports = { attachPresence, roomPresence };
