const { test } = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/chatRooms');
const ChatRoom = require('../models/ChatRoom');

// Exercise route handlers without a network listener or a live database.
async function request(method, path, overrides = {}) {
  const handler = router.stack.find((layer) => layer.route?.path === path
    && layer.route.methods[method]).route.stack[0].handle;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    sendStatus(code) { this.statusCode = code; return this; },
  };
  await handler({ params: { roomId: 'room' }, userId: 'owner', query: {}, ...overrides }, res);
  return res;
}

test('list pagination is bounded and excludes member arrays', async (t) => {
  const query = {
    sort(value) { assert.deepEqual(value, { _id: -1 }); return this; },
    skip(value) { assert.equal(value, 20); return this; },
    limit(value) { assert.equal(value, 20); return this; },
    select(value) { assert.equal(value, 'name createdBy createdAt updatedAt'); return this; },
    async lean() { return [{ name: 'General' }]; },
  };
  t.mock.method(ChatRoom, 'find', () => query);
  for (const query of [{ page: '0' }, { limit: '101' }, { page: {} }, { page: 'Infinity' }]) {
    assert.equal((await request('get', '/', { query })).statusCode, 400);
  }
  assert.deepEqual((await request('get', '/', { query: { page: '2' } })).body,
    { rooms: [{ name: 'General' }], page: 2, limit: 20 });
});

test('room details and owner-only changes', async (t) => {
  let room = { name: 'General' };
  t.mock.method(ChatRoom, 'findById', async () => room);
  t.mock.method(ChatRoom, 'exists', async () => room);
  t.mock.method(ChatRoom, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { _id: 'room', createdBy: 'owner' });
    assert.deepEqual(update, { $set: { name: 'Renamed' } });
    assert.equal(options.runValidators, true);
    assert.equal(options.new, true);
    return null;
  });
  t.mock.method(ChatRoom, 'findOneAndDelete', async (filter) => {
    assert.deepEqual(filter, { _id: 'room', createdBy: 'owner' });
    return null;
  });
  assert.deepEqual((await request('get', '/:roomId')).body, { room });
  assert.equal((await request('patch', '/:roomId', { body: { name: ' ' } })).statusCode, 400);
  const rename = () => request('patch', '/:roomId', { body: { name: ' Renamed ', createdBy: 'attacker' } });
  assert.equal((await rename()).statusCode, 403);
  assert.equal((await request('delete', '/:roomId')).statusCode, 403);
  room = null;
  assert.equal((await request('get', '/:roomId')).statusCode, 404);
  assert.equal((await rename()).statusCode, 404);
  assert.equal((await request('delete', '/:roomId')).statusCode, 404);
  ChatRoom.findOneAndUpdate.mock.mockImplementation(async () => ({ name: 'Renamed' }));
  assert.deepEqual((await rename()).body, { room: { name: 'Renamed' } });
  ChatRoom.findOneAndDelete.mock.mockImplementation(async () => ({ name: 'Renamed' }));
  assert.equal((await request('delete', '/:roomId')).statusCode, 204);
});
