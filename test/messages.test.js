const { test } = require('node:test');
const assert = require('node:assert/strict');
const { attachMessages } = require('../lib/messages');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');

test('messages validate input, persist trusted identity, and reach only authenticated members', async (t) => {
  let handler;
  let allowed = true;
  let savedCount = 0;
  const deliveries = [];
  const socket = (id) => ({
    request: { userId: id }, data: { user: { id, username: id } }, connected: true,
    on(event, callback) { assert.equal(event, 'message:send'); handler = callback; },
    emit(event, message) { deliveries.push({ id, event, message }); },
    disconnect() { this.connected = false; },
  });
  const sender = socket('sender');
  const recipient = socket('member');
  const outsider = socket('outsider');
  const expired = socket('expired');
  const io = { sockets: { sockets: new Map([sender, recipient, outsider, expired].map((s) => [s.request.userId, s])) } };
  t.mock.method(ChatRoom, 'findOne', async (query) => {
    assert.equal(query.members, 'sender');
    return allowed ? {} : null;
  });
  t.mock.method(ChatRoom, 'exists', async (query) => query.members !== 'outsider');
  t.mock.method(Message, 'create', async (data) => {
    savedCount++;
    assert.equal(data.sender, 'sender');
    assert.equal(data.content, 'Hello');
    return { ...data, _id: 'message-id', createdAt: new Date() };
  });
  attachMessages(io, sender, async (socket) => {
    if (socket === expired) throw new Error('Expired');
  });
  const send = async (payload) => {
    let result;
    await handler(payload, (reply) => { result = reply; });
    return result;
  };
  const roomId = '111111111111111111111111';
  for (const payload of [null, { roomId, content: ' ' }, { roomId, content: 'x'.repeat(5001) }]) {
    assert.equal((await send(payload)).ok, false);
  }
  allowed = false;
  assert.equal((await send({ roomId, content: 'Hello' })).ok, false);
  assert.equal(savedCount, 0);
  allowed = true;
  assert.equal((await send({ roomId, content: ' Hello ', sender: 'forged' })).ok, true);
  assert.equal(savedCount, 1);
  assert.deepEqual(deliveries.map(({ id, event }) => ({ id, event })), [
    { id: 'sender', event: 'message:new' }, { id: 'member', event: 'message:new' },
  ]);
  assert.equal(expired.connected, false);
  Message.create.mock.mockImplementation(async () => { throw new Error('Database failure'); });
  t.mock.method(console, 'error', () => {});
  assert.equal((await send({ roomId, content: 'Hello' })).ok, false);
  assert.equal(deliveries.length, 2);
});
