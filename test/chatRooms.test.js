const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const app = require('../server');
const Session = require('../models/Session');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');

test('authenticated room creation and membership', async (t) => {
  const userId = '111111111111111111111111';
  const roomId = '222222222222222222222222';
  const token = 'a'.repeat(64);
  let expiresAt = new Date(Date.now() + 60000);
  let userExists = true;
  let room;
  t.mock.method(Session, 'findOne', async (query) => {
    assert.ok(query.expiresAt.$gt instanceof Date);
    return query.tokenHash === createHash('sha256').update(token).digest('hex')
      && expiresAt > query.expiresAt.$gt ? { user: userId } : null;
  });
  t.mock.method(User, 'exists', async () => userExists ? { _id: userId } : null);
  t.mock.method(ChatRoom, 'create', async (data) => {
    room = { _id: roomId, ...data };
    return room;
  });
  t.mock.method(ChatRoom, 'findByIdAndUpdate', async (id, update, options) => {
    assert.equal(options.new, true);
    if (id !== roomId) return null;
    if (update.$addToSet) {
      assert.equal(update.$addToSet.members, userId);
      room.members = [...new Set([...room.members, update.$addToSet.members])];
    } else {
      assert.equal(update.$pull.members, userId);
      room.members = room.members.filter((id) => id !== update.$pull.members);
    }
    return room;
  });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (err) => err ? reject(err) : resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (path, body = {}, cookie = `session=${token}`) => fetch(
    `http://127.0.0.1:${server.address().port}/api/chatRooms${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(body),
    });

  assert.equal((await post('/', {}, '')).status, 401);
  assert.equal((await post('/', {}, 'session=invalid')).status, 401);
  assert.equal((await post('/', {}, `session=${'b'.repeat(64)}`)).status, 401);
  expiresAt = new Date(0);
  assert.equal((await post('/')).status, 401);
  expiresAt = new Date(Date.now() + 60000);
  userExists = false;
  assert.equal((await post('/')).status, 401);
  userExists = true;
  for (const name of ['', '   ', 'a'.repeat(101), { $ne: null }]) {
    assert.equal((await post('/', { name })).status, 400);
  }
  const created = await post('/', { name: ' General ', createdBy: 'attacker', members: ['attacker'] });
  assert.equal(created.status, 201);
  assert.deepEqual((await created.json()).room, {
    _id: roomId, name: 'General', createdBy: userId, members: [userId],
  });
  for (const action of ['join', 'leave']) {
    assert.equal((await post(`/bad-id/${action}`)).status, 400);
    assert.equal((await post(`/333333333333333333333333/${action}`)).status, 404);
    assert.equal((await post(`/${roomId}/${action}`, {}, '')).status, 401);
  }
  for (const action of ['leave', 'leave', 'join', 'join']) {
    const response = await post(`/${roomId}/${action}`, { userId: 'attacker' });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).room.members, action === 'join' ? [userId] : []);
  }
});
