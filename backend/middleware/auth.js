const { verifyToken } = require('../lib/tokens');
const User = require('../models/User');
const { HttpError } = require('../lib/validate');
const db = require('../config/db');

/**
 * Require a valid session cookie.
 *
 * The JWT is only accepted if the user still exists and its `tokenVersion`
 * still matches, which is what lets password changes and "log out everywhere"
 * take effect immediately instead of at token expiry.
 *
 * Every tool route is behind this: the PDF merger and the image compressor are
 * account-only, so the server is the enforcement point and the client-side
 * route guard is only there to explain the redirect.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[require('../config/env').auth.cookieName];
    if (!token) throw new HttpError(401, 'You need to sign in to continue.');

    let payload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new HttpError(401, 'Your session has expired. Please sign in again.');
      }
      throw new HttpError(401, 'Your session is no longer valid. Please sign in again.');
    }

    if (!db.isConnected()) {
      throw new HttpError(503, 'The account service is temporarily unavailable. Please try again shortly.');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new HttpError(401, 'Your account could not be found. Please sign in again.');
    if ((user.tokenVersion || 0) !== (payload.tv || 0)) {
      throw new HttpError(401, 'Your session has been revoked. Please sign in again.');
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof HttpError) return next(error);
    return next(error);
  }
}

module.exports = { requireAuth };
