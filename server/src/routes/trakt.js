const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('../models/User');
const config = require('../config');
const trakt = require('../services/trakt');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(requireAuth);

// A full sync is heavy (Trakt + TMDB for every title) — keep it deliberate.
const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.userId,
  message: { message: 'Sync is cooling down, try again in a few minutes' },
});

router.get('/status', async (req, res) => {
  const user = await User.findById(req.userId);
  res.json({ available: config.trakt.enabled, ...user.toPublic().trakt });
});

router.post('/device', async (_req, res) => {
  res.json(await trakt.startDeviceAuth());
});

router.post(
  '/device/poll',
  validate({ body: z.object({ deviceCode: z.string().min(1) }) }),
  async (req, res) => {
    res.json(await trakt.pollDeviceAuth(req.userId, req.valid.body.deviceCode));
  }
);

router.post('/sync', syncLimiter, async (req, res) => {
  res.json(await trakt.fullSync(req.userId));
});

router.delete('/', async (req, res) => {
  await trakt.disconnect(req.userId);
  res.json({ message: 'Trakt disconnected' });
});

module.exports = router;
