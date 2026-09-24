const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roomPresence } = require('../lib/presence');

test('presence includes only online members and counts multiple tabs once', () => {
  const alice = { id: 'alice', username: 'Alice' };
  const bob = { id: 'bob', username: 'Bob' };
  const rooms = [{ _id: 'one', members: ['alice', 'offline'] }, { _id: 'two', members: ['bob'] }];
  assert.deepEqual(roomPresence(rooms, [alice, alice, bob]), { one: [alice], two: [bob] });
  assert.deepEqual(roomPresence(rooms, [alice]), { one: [alice], two: [] });
  assert.deepEqual(roomPresence(rooms, []), { one: [], two: [] });
});
