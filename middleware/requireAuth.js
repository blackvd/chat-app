const { createHash } = require('node:crypto');
const Session = require('../models/Session');
const User = require('../models/User');

module.exports = async function requireAuth(req, res, next) {
  const token = (req.headers.cookie || '').split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('session='))?.slice('session='.length);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(401).json({ error: 'Log in to continue.' });
  }

  const session = await Session.findOne({
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: { $gt: new Date() },
  });
  if (!session || !await User.exists({ _id: session.user })) {
    return res.status(401).json({ error: 'Log in to continue.' });
  }
  req.userId = session.user;
  next();
};
