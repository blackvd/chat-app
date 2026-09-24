const express = require('express');
const path = require('node:path');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const chatRoomRoutes = require('./routes/chatRooms');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const app = express();
const port = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/chatRooms', chatRoomRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get(['/login', '/register', '/chatRooms/new'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Set MONGODB_URI in .env or the environment before starting the server.');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all([
    require('./models/User').init(),
    require('./models/Session').init(),
  ]);
  console.log('Connected to MongoDB');

  const server = app.listen(port, (err) => {
    if (err) return;
    console.log(`Server listening on port ${server.address().port}`);
  });

  server.on('error', async (err) => {
    console.error('Failed to start server:', err.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  });
}

if (require.main === module) {
  startServer().catch(async (err) => {
    console.error('Failed to connect to MongoDB:', err.name);
    if (!process.env.MONGODB_URI) console.error(err.message);
    process.exitCode = 1;
    await mongoose.disconnect();
  });
}

module.exports = app;
