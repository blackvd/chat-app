const express = require('express');
const { randomBytes, createHash } = require('node:crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { hashPassword, verifyPassword } = require('../lib/password');

const router = express.Router();

const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const cookieName = 'session';
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

function sessionToken(req) {
  return (req.headers.cookie || '').split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

function publicUser(user) {
  return { id: user._id, username: user.username, email: user.email };
}

function credentials(body) {
  const { email, password } = body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) return null;
  return { email: normalizedEmail, password };
}

router.post('/register', async (req, res) => {
  const input = credentials(req.body);
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!input || username.length < 2 || username.length > 50) {
    return res.status(400).json({ error: 'Provide a username (2–50 characters), valid email, and password (at least 8 characters, at most 72 UTF-8 bytes).' });
  }

  try {
    const user = await User.create({
      username,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const input = credentials(req.body);
  if (!input) return res.status(400).json({ error: 'Provide a valid email and password (at least 8 characters, at most 72 UTF-8 bytes).' });

  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user || !await verifyPassword(input.password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const previousToken = sessionToken(req);
  if (previousToken) await Session.deleteOne({ tokenHash: tokenHash(previousToken) });
  const token = randomBytes(32).toString('hex');
  await Session.create({
    tokenHash: tokenHash(token),
    user: user._id,
    expiresAt: new Date(Date.now() + sessionDuration),
  });
  res.cookie(cookieName, token, { ...cookieOptions(), maxAge: sessionDuration });
  res.json({ user: publicUser(user) });
});

router.post('/logout', async (req, res) => {
  const token = sessionToken(req);
  if (token) await Session.deleteOne({ tokenHash: tokenHash(token) });
  res.clearCookie(cookieName, cookieOptions());
  res.sendStatus(204);
});

module.exports = router;
