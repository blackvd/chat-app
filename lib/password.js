const bcrypt = require('bcrypt');

const saltRounds = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { hashPassword, verifyPassword };
