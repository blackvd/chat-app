const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const app = require('../server');
const User = require('../models/User');
const Session = require('../models/Session');

test('registration, login, and logout lifecycle', async (t) => {
  let user;
  const sessions = new Map();
  t.mock.method(User, 'create', async (data) => {
    if (user) throw Object.assign(new Error('Duplicate email'), { code: 11000 });
    user = { _id: 'test-user', ...data };
    return user;
  });
  t.mock.method(User, 'findOne', ({ email }) => ({
    select: async () => user?.email === email ? user : null,
  }));
  t.mock.method(Session, 'create', async (data) => sessions.set(data.tokenHash, data));
  t.mock.method(Session, 'deleteOne', async ({ tokenHash }) => sessions.delete(tokenHash));

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', (err) => err ? reject(err) : resolve(instance));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (route, body, cookie) => fetch(`${base}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const input = { username: 'Alice', email: 'Alice@Example.com', password: 'test-password-123' };

  assert.equal((await post('register', { ...input, password: 'short' })).status, 400);
  for (const password of ['a'.repeat(73), 'é'.repeat(37)]) {
    assert.equal((await post('register', { ...input, password })).status, 400);
    assert.equal((await post('login', { ...input, password })).status, 400);
  }
  assert.equal((await post('login', { email: { $ne: null }, password: input.password })).status, 400);
  const registered = await post('register', input);
  assert.equal(registered.status, 201);
  assert.deepEqual(await registered.json(), {
    user: { id: 'test-user', username: 'Alice', email: 'alice@example.com' },
  });
  assert.notEqual(user.passwordHash, input.password);
  assert.match(user.passwordHash, /^\$2b\$12\$/);
  assert.equal((await post('register', input)).status, 409);
  assert.equal((await post('login', { ...input, password: 'wrong-password' })).status, 401);
  assert.equal((await post('login', { ...input, email: 'missing@example.com' })).status, 401);

  const login = await post('login', input);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.passwordHash, undefined);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  const cookie = header.split(';')[0];
  const token = cookie.slice('session='.length);
  assert.equal(sessions.has(token), false);
  assert.equal(sessions.has(createHash('sha256').update(token).digest('hex')), true);
  const relogin = await post('login', input, cookie);
  assert.equal(relogin.status, 200);
  assert.equal(sessions.size, 1);
  const newCookie = relogin.headers.get('set-cookie').split(';')[0];
  assert.notEqual(newCookie, cookie);
  const logout = await post('logout', {}, newCookie);
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal(sessions.size, 0);
  assert.equal((await post('logout', {})).status, 204);
});
