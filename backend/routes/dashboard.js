const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { dashboard } = require('../controllers/authController');
const { HttpError } = require('../lib/validate');

const router = express.Router();

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Every route below this line requires a valid session cookie.
router.use(readLimiter, requireAuth);

router.get('/', dashboard);
router.get('/stats', dashboard);

router.all('/', (req) => {
  throw new HttpError(404, 'Unknown dashboard endpoint.');
});

module.exports = router;
