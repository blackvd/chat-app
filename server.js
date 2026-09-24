const express = require('express');
const path = require('node:path');
const mongoose = require('mongoose');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { attachPresence } = require('./lib/presence');
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
app.use('/api', (req, res, next) => {
  res.on('finish', () => {
    if (req.method !== 'GET' && res.statusCode < 400) app.locals.refreshPresence?.();
  });
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/chatRooms', chatRoomRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get(['/login', '/register', '/chatRooms/new', '/chatRooms'], (req, res) => {
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
    require('./models/Message').init(),
  ]);
  console.log('Connected to MongoDB');

  const server = createServer(app);
  // A shorter ping keeps long-polling requests well under proxy timeouts (e.g. Netlify).
  const io = new Server(server, { pingInterval: 10000 });
  app.locals.io = io;
  attachPresence(io, app);

  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    process.removeListener('SIGINT', handleShutdown);
    process.removeListener('SIGTERM', handleShutdown);
    await new Promise((resolve) => io.close(resolve));
    delete app.locals.io;
    await mongoose.disconnect();
  }
  const handleShutdown = () => {
    shutdown().catch((err) => {
      console.error('Failed to shut down server:', err.name);
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
  server.listen(port, () => {
    console.log(`Server listening on port ${server.address().port}`);
  });

  server.on('error', async (err) => {
    console.error('Failed to start server:', err.message);
    process.exitCode = 1;
    await shutdown();
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
