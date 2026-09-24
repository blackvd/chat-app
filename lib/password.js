const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, hash) {
  const [salt, encodedKey] = hash.split(':');
  const key = await deriveKey(password, salt, 64);
  const expected = Buffer.from(encodedKey, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}

module.exports = { hashPassword, verifyPassword };
