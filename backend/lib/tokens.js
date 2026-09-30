const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * JWT + HTTP-only cookie helpers.
 *
 * The token only ever travels inside an HttpOnly cookie: the browser stores it
 * in the cookie jar where JavaScript cannot read it, so an XSS bug cannot steal
 * a session the way it could from localStorage.
 */

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      // Bumping `tokenVersion` on the user immediately invalidates old cookies.
      tv: user.tokenVersion || 0,
    },
    config.auth.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: `${config.auth.sessionMaxAgeDays}d`,
      issuer: 'northstar',
      audience: 'northstar-web',
    },
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, {
    algorithms: ['HS256'], // pinned: blocks `alg: none` and RS/HS confusion
    issuer: 'northstar',
    audience: 'northstar-web',
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction, // requires HTTPS in production
    sameSite: 'lax', // blocks cross-site POSTs while allowing normal top-level navigation
    path: '/',
    maxAge: config.auth.maxAgeMs,
  };
}

function setSessionCookie(res, token) {
  res.cookie(config.auth.cookieName, token, cookieOptions());
}

function clearSessionCookie(res) {
  // Match the same attributes as setSessionCookie, otherwise some browsers keep
  // the original cookie. maxAge 0 expires it immediately.
  res.clearCookie(config.auth.cookieName, { ...cookieOptions(), maxAge: 0 });
}

module.exports = { signToken, verifyToken, setSessionCookie, clearSessionCookie, cookieOptions };
