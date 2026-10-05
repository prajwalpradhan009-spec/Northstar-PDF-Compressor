const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./env');

// On systems where local DNS resolver rejects SRV lookups (querySrv ECONNREFUSED):
if (config.mongo.uri && config.mongo.uri.includes('+srv')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    // If setting custom DNS fails, proceed with default resolver
  }
}

/**
 * Reusable MongoDB connection module.
 *
 * The API degrades to a clearly-reported "offline" state rather than crashing
 * the process when the database is unreachable, then reconnects with capped
 * exponential backoff. Tools that need no account (PDF merge, image
 * compression) keep working throughout.
 */

let retryTimer = null;
let attempt = 0;
let shuttingDown = false;

const READY_STATE = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function isConnected() {
  return mongoose.connection.readyState === 1;
}

function status() {
  return READY_STATE[mongoose.connection.readyState] || 'unknown';
}

function connectWithRetry() {
  if (shuttingDown || !config.mongo.uri) return;

  attempt += 1;
  mongoose
    .connect(config.mongo.uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      autoIndex: !config.isProduction,
    })
    .then(() => {
      attempt = 0;
      console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
    })
    .catch((err) => {
      // Cap the backoff so a database that comes back is picked up quickly.
      const delay = Math.min(30000, 2000 * attempt);
      console.warn(`[db] Connection attempt ${attempt} failed: ${err.message}`);
      console.warn(`[db] Accounts/history are offline. Retrying in ${Math.round(delay / 1000)}s...`);
      scheduleRetry(delay);
    });
}

function scheduleRetry(delay) {
  if (shuttingDown || retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connectWithRetry();
  }, delay);
  if (typeof retryTimer.unref === 'function') retryTimer.unref();
}

function connect() {
  if (!config.mongo.uri) {
    console.warn('[db] MONGODB_URI is not set. Accounts, history and saved files are disabled.');
    return;
  }

  mongoose.connection.on('disconnected', () => {
    if (shuttingDown) return;
    console.warn('[db] MongoDB disconnected. Scheduling reconnect...');
    scheduleRetry(2000);
  });

  mongoose.connection.on('connected', () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    attempt = 0;
  });

  mongoose.connection.on('error', (err) => {
    console.warn(`[db] MongoDB error: ${err.message}`);
  });

  connectWithRetry();
}

async function disconnect() {
  shuttingDown = true;
  clearTimeout(retryTimer);
  retryTimer = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
  }
}

module.exports = { connect, disconnect, isConnected, status, mongoose };
