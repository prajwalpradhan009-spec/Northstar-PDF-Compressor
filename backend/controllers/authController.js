const User = require('../models/User');
const Activity = require('../models/Activity');
const db = require('../config/db');
const { signToken, setSessionCookie, clearSessionCookie } = require('../lib/tokens');
const { HttpError, validateSignup, validateSignin, assertNoErrors } = require('../lib/validate');

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

module.exports = { signup, signin, logout, me, updateProfile, logoutAll, dashboard };
