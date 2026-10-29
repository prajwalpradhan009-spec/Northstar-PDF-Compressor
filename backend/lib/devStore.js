const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Resilient In-Memory Development Store.
 *
 * When MongoDB is temporarily offline or when DNS SRV resolution fails
 * (e.g. querySrv ECONNREFUSED on local machines/ISPs), this store provides
 * seamless user registration, sign-in, and session management in development mode
 * so developers and users are never locked out with 503 errors.
 */

class DevUser {
  constructor({ id, name, email, passwordHash }) {
    this._id = id || crypto.randomUUID();
    this.name = name;
    this.email = email.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.tokenVersion = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.lastLoginAt = null;
    this.passwordResetCodeHash = null;
    this.passwordResetExpiresAt = null;
    this.passwordResetAttempts = 0;
    this.passwordResetVerified = false;
    this.passwordResetTokenHash = null;
    this.passwordResetTokenExpiresAt = null;
  }

  async verifyPassword(candidate) {
    if (!candidate || !this.passwordHash) return false;
    return bcrypt.compare(candidate, this.passwordHash);
  }

  toPublicJSON() {
    return {
      id: this._id.toString(),
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
      lastLoginAt: this.lastLoginAt,
    };
  }

  async save() {
    this.updatedAt = new Date();
    devUsers.set(this.email, this);
    devUsersById.set(this._id.toString(), this);
    return this;
  }
}

const devUsers = new Map();
const devUsersById = new Map();
const devActivities = [];

const devStore = {
  async createUser({ name, email, password }) {
    const normalizedEmail = email.toLowerCase().trim();
    if (devUsers.has(normalizedEmail)) {
      const err = new Error('An account with that email already exists.');
      err.code = 11000;
      throw err;
    }
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new DevUser({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hash,
    });
    devUsers.set(normalizedEmail, user);
    devUsersById.set(user._id.toString(), user);
    console.log(`[devStore] Registered user "${normalizedEmail}" in local dev store.`);
    return user;
  },

  async findByEmail(email) {
    if (!email) return null;
    return devUsers.get(email.toLowerCase().trim()) || null;
  },

  async findById(id) {
    if (!id) return null;
    return devUsersById.get(id.toString()) || null;
  },

  async logActivity({ userId, type, fileCount = 0, totalBytes = 0, savedBytes = 0 }) {
    devActivities.push({
      userId: userId ? userId.toString() : null,
      type,
      fileCount,
      totalBytes,
      savedBytes,
      createdAt: new Date(),
    });
  },

  async getDashboard(userId) {
    const user = await this.findById(userId);
    const userActivities = devActivities.filter((a) => a.userId === userId.toString());
    const totalFiles = userActivities.reduce((acc, a) => acc + (a.fileCount || 0), 0);
    const totalBytes = userActivities.reduce((acc, a) => acc + (a.totalBytes || 0), 0);
    const totalSaved = userActivities.reduce((acc, a) => acc + (a.savedBytes || 0), 0);

    return {
      user: user ? user.toPublicJSON() : null,
      stats: {
        totalOperations: userActivities.length,
        totalFiles,
        totalBytes,
        totalSavedBytes: totalSaved,
      },
      recentActivity: userActivities.slice(-10).reverse(),
    };
  },
};

module.exports = { devStore, DevUser };
