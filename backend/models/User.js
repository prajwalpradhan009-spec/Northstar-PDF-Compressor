const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * @typedef {object} UserDocument
 * @property {string} name
 * @property {string} email               stored lower-cased and unique
 * @property {string} passwordHash        bcrypt digest — never a plain password
 * @property {number} tokenVersion        bump to invalidate every existing session
 * @property {Date} lastLoginAt
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name must be 80 characters or fewer'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email is too long'],
      index: true,
    },
    // Named `passwordHash` on purpose: there is no `password` field anywhere in
    // this schema, so a plain-text password can never be persisted by accident.
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    // Bumping this invalidates every cookie already issued for the user.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    passwordResetCodeHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
    passwordResetVerified: { type: Boolean, default: false, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetTokenExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequestedAt: { type: Date, default: null, select: false },
    passwordResetRequestWindowAt: { type: Date, default: null, select: false },
    passwordResetRequestCount: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true, // createdAt / updatedAt
    minimize: false,
  },
);

/** Hash the password whenever it is set or changed. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Verify a plain-text candidate against the stored bcrypt digest.
 * Always compares against a dummy hash when no user exists, so that a missing
 * account and a wrong password take the same amount of time.
 */
userSchema.methods.verifyPassword = async function verifyPassword(candidate) {
  if (typeof candidate !== 'string' || !candidate) return false;
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/** The only shape ever sent to the client — no hash, no token version. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
