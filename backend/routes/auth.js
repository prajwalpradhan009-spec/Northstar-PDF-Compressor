const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { HttpError } = require('../lib/validate');

const router = express.Router();

/**
 * Brute-force protection. The limit is per-IP and generous enough that a real
 * user on a shared/NAT connection is not locked out, while a scripted attacker
 * is slowed to a crawl.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please wait before requesting another email.' },
});
const passwordResetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please wait a few minutes and try again.' },
});
const passwordResetResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many verification code requests. Please wait before trying again.' },
});

router.post('/signup', authLimiter, controller.signup);
router.post('/signin', authLimiter, controller.signin);
router.post('/forgot-password', passwordResetRequestLimiter, controller.forgotPassword);
router.post('/verify-otp', passwordResetVerifyLimiter, controller.verifyOtp);
router.post('/resend-otp', passwordResetResendLimiter, controller.resendOtp);
router.post('/reset-password', passwordResetVerifyLimiter, controller.resetPassword);
router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);
router.patch('/me', requireAuth, controller.updateProfile);
router.post('/logout-all', requireAuth, controller.logoutAll);

router.all('/', (req) => {
  throw new HttpError(404, 'Unknown auth endpoint.');
});

module.exports = router;
