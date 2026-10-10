const crypto = require('node:crypto');
const User = require('../models/User');
const Activity = require('../models/Activity');
const db = require('../config/db');
const config = require('../config/env');
const { sendPasswordResetCode } = require('../lib/email');
const { signToken, setSessionCookie, clearSessionCookie } = require('../lib/tokens');
const {
  HttpError,
  validateSignup,
  validateSignin,
  validateOtpVerification,
  validatePasswordReset,
  assertNoErrors,
} = require('../lib/validate');

const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const RESET_REQUEST_MAX_PER_WINDOW = 5;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const GENERIC_RESET_MESSAGE = 'If an account with that email exists, a verification code has been sent.';

function hashResetCode(email, code) {
  return crypto.createHmac('sha256', config.auth.jwtSecret)
    .update(`${email}:${code}`)
    .digest('hex');
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeHashMatch(expected, submitted) {
  if (typeof expected !== 'string' || typeof submitted !== 'string') return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const submittedBuffer = Buffer.from(submitted, 'hex');
  return expectedBuffer.length === submittedBuffer.length
    && expectedBuffer.length > 0
    && crypto.timingSafeEqual(expectedBuffer, submittedBuffer);
}

function genericResetResponse(res) {
  res.json({
    message: GENERIC_RESET_MESSAGE,
    expiresInMinutes: config.email.otpExpiresMinutes,
  });
}

function clearResetAuthorization() {
  return {
    passwordResetCodeHash: null,
    passwordResetExpiresAt: null,
    passwordResetAttempts: 0,
    passwordResetVerified: false,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
  };
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/signup
 * ------------------------------------------------------------------ */
async function signup(req, res, next) {
  try {
    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }

    const { errors, value } = validateSignup(req.body || {});
    assertNoErrors(errors);

    const existing = await User.findOne({ email: value.email }).lean();
    if (existing) {
      // 409 + a field message, so the form can highlight the email input.
      throw new HttpError(409, 'An account with that email already exists.', {
        email: 'An account with that email already exists.',
      });
    }

    let user;
    try {
      user = new User({ name: value.name, email: value.email, passwordHash: value.password });
      await user.save(); // the pre-save hook hashes into `passwordHash`
    } catch (error) {
      // Unique index violation — two signups raced past the findOne above.
      if (error && error.code === 11000) {
        throw new HttpError(409, 'An account with that email already exists.', {
          email: 'An account with that email already exists.',
        });
      }
      if (error && error.errors) {
        throw new HttpError(400, Object.values(error.errors)[0].message, error.errors);
      }
      throw error;
    }

    // Per the spec, signup does not sign you in — you are sent to /signin.
    res.status(201).json({
      message: 'Account created successfully.',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/signin
 * ------------------------------------------------------------------ */
async function signin(req, res, next) {
  try {
    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }

    const { errors, value } = validateSignin(req.body || {});
    assertNoErrors(errors);

    const user = await User.findOne({ email: value.email });

    // Compare even when the user is missing, so a wrong email and a wrong
    // password take the same time and cannot be told apart.
    const ok = user
      ? await user.verifyPassword(value.password)
      : await User.prototype.verifyPassword.call(
        { passwordHash: '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva' },
        value.password,
      );

    if (!user || !ok) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    setSessionCookie(res, signToken(user));

    res.json({ message: 'Welcome back!', user: user.toPublicJSON() });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/forgot-password
 * ------------------------------------------------------------------ */
async function requestPasswordReset(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { errors } = validateSignin({ email, password: 'unused' });
    if (errors.email || email.length > 254) {
      const message = errors.email || 'Please enter a valid email address.';
      throw new HttpError(400, message, { email: message });
    }

    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }
    if (!config.email.configured) {
      throw new HttpError(503, 'Password reset email is not configured yet. Please contact the site administrator.');
    }

    const user = await User.findOne({ email }).select('_id');
    if (!user) return genericResetResponse(res);

    const now = new Date();
    const cooldownBefore = new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS);
    const windowBefore = new Date(now.getTime() - RESET_REQUEST_WINDOW_MS);
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = hashResetCode(email, code);
    const newWindow = {
      $or: [
        { $eq: [{ $ifNull: ['$passwordResetRequestWindowAt', null] }, null] },
        { $lte: ['$passwordResetRequestWindowAt', windowBefore] },
      ],
    };

    // Atomically apply both the per-email cooldown and hourly cap, including
    // across multiple API instances. A blocked request gets the same response
    // as an unknown email, so this state cannot be used to enumerate accounts.
    const resetUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        $and: [
          {
            $or: [
              { passwordResetRequestedAt: { $exists: false } },
              { passwordResetRequestedAt: null },
              { passwordResetRequestedAt: { $lte: cooldownBefore } },
            ],
          },
          {
            $or: [
              { passwordResetRequestWindowAt: { $exists: false } },
              { passwordResetRequestWindowAt: null },
              { passwordResetRequestWindowAt: { $lte: windowBefore } },
              { passwordResetRequestCount: { $lt: RESET_REQUEST_MAX_PER_WINDOW } },
            ],
          },
        ],
      },
      [
        {
          $set: {
            passwordResetCodeHash: codeHash,
            passwordResetExpiresAt: new Date(now.getTime() + config.email.otpExpiresMinutes * 60 * 1000),
            passwordResetAttempts: 0,
            passwordResetVerified: false,
            passwordResetTokenHash: null,
            passwordResetTokenExpiresAt: null,
            passwordResetRequestedAt: now,
            passwordResetRequestWindowAt: {
              $cond: [newWindow, now, '$passwordResetRequestWindowAt'],
            },
            passwordResetRequestCount: {
              $cond: [
                newWindow,
                1,
                { $add: [{ $ifNull: ['$passwordResetRequestCount', 0] }, 1] },
              ],
            },
          },
        },
      ],
      { new: true },
    );

    if (!resetUser) return genericResetResponse(res);

    try {
      await sendPasswordResetCode(email, code);
    } catch (error) {
      await User.updateOne(
        { _id: resetUser._id, passwordResetCodeHash: codeHash },
        { $set: clearResetAuthorization() },
      );
      // Server-side only: log the real SMTP failure so the host log shows the
      // cause (e.g. ETIMEDOUT/ECONNECTION from a blocked port, or EAUTH from a
      // rejected app password). The HTTP response stays generic regardless, so
      // it never reveals whether this address has an account.
      const reason = [
        error?.code,
        error?.command,
        error?.responseCode,
        error?.message,
      ].filter(Boolean).join(' | ') || 'unknown error';
      const provider = config.email.provider === 'resend'
        ? 'Resend API'
        : `${config.email.smtp.host}:${config.email.smtp.port}`;
      console.error(
        `[auth] password reset email delivery failed via ${provider}: ${reason}`,
      );
    }

    return genericResetResponse(res);
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/verify-otp
 * ------------------------------------------------------------------ */
async function verifyOtp(req, res, next) {
  try {
    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }

    const { errors, value } = validateOtpVerification(req.body || {});
    assertNoErrors(errors);

    const user = await User.findOne({ email: value.email }).select(
      '+passwordResetCodeHash +passwordResetExpiresAt +passwordResetAttempts +passwordResetVerified',
    );
    if (
      !user
      || !user.passwordResetCodeHash
      || !user.passwordResetExpiresAt
    ) {
      throw new HttpError(400, 'The verification code is incorrect or expired.');
    }
    if (user.passwordResetAttempts >= RESET_CODE_MAX_ATTEMPTS) {
      throw new HttpError(429, 'Too many incorrect verification codes. Request a new code.');
    }

    if (user.passwordResetExpiresAt.getTime() <= Date.now()) {
      const matchesExpiredCode = safeHashMatch(user.passwordResetCodeHash, hashResetCode(value.email, value.otp));
      await User.updateOne(
        {
          _id: user._id,
          passwordResetCodeHash: user.passwordResetCodeHash,
          passwordResetExpiresAt: { $lte: new Date() },
        },
        { $set: clearResetAuthorization() },
      );
      if (matchesExpiredCode) {
        throw new HttpError(400, 'That verification code has expired. Request a new code.');
      }
      throw new HttpError(400, 'The verification code is incorrect or expired.');
    }

    if (!safeHashMatch(user.passwordResetCodeHash, hashResetCode(value.email, value.otp))) {
      const attemptedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          passwordResetCodeHash: user.passwordResetCodeHash,
          passwordResetExpiresAt: { $gt: new Date() },
          passwordResetAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
        },
        { $inc: { passwordResetAttempts: 1 } },
        { new: true },
      ).select('+passwordResetAttempts');

      if (attemptedUser?.passwordResetAttempts >= RESET_CODE_MAX_ATTEMPTS) {
        await User.updateOne(
          {
            _id: user._id,
            passwordResetCodeHash: user.passwordResetCodeHash,
            passwordResetAttempts: { $gte: RESET_CODE_MAX_ATTEMPTS },
          },
          { $set: clearResetAuthorization() },
        );
        throw new HttpError(429, 'Too many incorrect verification codes. Request a new code.');
      }
      throw new HttpError(400, 'That verification code is incorrect.');
    }

    const resetToken = crypto.randomBytes(32).toString('base64url');
    const verifiedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetCodeHash: user.passwordResetCodeHash,
        passwordResetExpiresAt: { $gt: new Date() },
        passwordResetAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
      },
      {
        $set: {
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetAttempts: 0,
          passwordResetVerified: true,
          passwordResetTokenHash: hashResetToken(resetToken),
          passwordResetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      },
      { new: true },
    );
    if (!verifiedUser) throw new HttpError(400, 'The verification code is incorrect or expired.');

    res.json({ resetToken });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/reset-password
 * ------------------------------------------------------------------ */
async function resetPassword(req, res, next) {
  try {
    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }

    const { errors, value } = validatePasswordReset(req.body || {});
    assertNoErrors(errors);

    const user = await User.findOne({ email: value.email }).select(
      '+passwordResetVerified +passwordResetTokenHash +passwordResetTokenExpiresAt',
    );
    if (
      !user
      || !user.passwordResetVerified
      || !user.passwordResetTokenHash
      || !user.passwordResetTokenExpiresAt
    ) {
      throw new HttpError(400, 'Your reset authorization is invalid or expired. Verify your email code again.');
    }
    if (user.passwordResetTokenExpiresAt.getTime() <= Date.now()) {
      await User.updateOne(
        {
          _id: user._id,
          passwordResetTokenHash: user.passwordResetTokenHash,
          passwordResetTokenExpiresAt: { $lte: new Date() },
        },
        { $set: clearResetAuthorization() },
      );
      throw new HttpError(400, 'Your reset authorization is invalid or expired. Verify your email code again.');
    }
    if (!safeHashMatch(user.passwordResetTokenHash, hashResetToken(value.resetToken))) {
      throw new HttpError(400, 'Your reset authorization is invalid or expired. Verify your email code again.');
    }

    const passwordHash = await User.hashPassword(value.newPassword);
    const update = await User.updateOne(
      {
        _id: user._id,
        passwordResetVerified: true,
        passwordResetTokenHash: user.passwordResetTokenHash,
        passwordResetTokenExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordHash,
          ...clearResetAuthorization(),
        },
        $inc: { tokenVersion: 1 },
      },
    );
    if (update.modifiedCount !== 1) {
      throw new HttpError(400, 'Your reset authorization is invalid or expired. Verify your email code again.');
    }

    res.json({ message: 'Your password has been reset. Sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
}

const forgotPassword = (req, res, next) => requestPasswordReset(req, res, next);
const resendOtp = (req, res, next) => requestPasswordReset(req, res, next);

/* ------------------------------------------------------------------ *
 * POST /api/auth/logout
 * ------------------------------------------------------------------ */
async function logout(req, res, next) {
  try {
    clearSessionCookie(res);
    res.json({ message: 'You have been signed out.' });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/auth/me — session probe used on app boot
 * ------------------------------------------------------------------ */
async function me(req, res, next) {
  try {
    if (!db.isConnected()) throw new HttpError(503, 'The account service is temporarily unavailable.');
    res.json({ user: req.user.toPublicJSON() });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/auth/me — update the display name
 * ------------------------------------------------------------------ */
async function updateProfile(req, res, next) {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 2) throw new HttpError(400, 'Full name must be at least 2 characters.', { name: 'Full name must be at least 2 characters.' });
    if (name.length > 80) throw new HttpError(400, 'Full name must be 80 characters or fewer.', { name: 'Full name must be 80 characters or fewer.' });

    req.user.name = name;
    await req.user.save();

    // The name is baked into the token payload, so re-issue the cookie.
    setSessionCookie(res, signToken(req.user));

    res.json({ message: 'Profile updated.', user: req.user.toPublicJSON() });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/auth/logout-all — bump tokenVersion to kill every session
 * ------------------------------------------------------------------ */
async function logoutAll(req, res, next) {
  try {
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save({ validateBeforeSave: false });
    clearSessionCookie(res);
    res.json({ message: 'Signed out of all devices.' });
  } catch (error) {
    return next(error);
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/dashboard — protected stats
 * ------------------------------------------------------------------ */
async function dashboard(req, res, next) {
  try {
    const userId = req.user._id;

    // One row per activity type, so the result is a list — not a single row.
    const rows = await Activity.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: '$type',
          runs: { $sum: 1 },
          files: { $sum: '$fileCount' },
          inputBytes: { $sum: '$inputBytes' },
          outputBytes: { $sum: '$outputBytes' },
        },
      },
    ]);

    const byType = Object.fromEntries(rows.map((row) => [row._id, row]));
    const empty = { runs: 0, files: 0, inputBytes: 0, outputBytes: 0 };
    const merge = byType['pdf-merge'] || empty;
    const image = byType['image-compress'] || empty;

    const recent = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.json({
      user: req.user.toPublicJSON(),
      stats: {
        pdfMerges: merge.runs,
        imagesCompressed: image.files,
        filesProcessed: merge.files + image.files,
        bytesSaved: Math.max(0, (merge.inputBytes - merge.outputBytes) + (image.inputBytes - image.outputBytes)),
      },
      recent: recent.map((row) => ({
        id: row._id.toString(),
        type: row.type,
        fileCount: row.fileCount,
        inputBytes: row.inputBytes,
        outputBytes: row.outputBytes,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  signup,
  signin,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  logout,
  me,
  updateProfile,
  logoutAll,
  dashboard,
};
