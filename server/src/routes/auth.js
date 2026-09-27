const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const User = require('../models/User');
const Show = require('../models/Show');
const History = require('../models/History');
const { requireAuth, signToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { badRequest, conflict, unauthorized, notFound } = require('../lib/errors');

const router = express.Router();

// Slow down password guessing without bothering real users.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, try again in a few minutes' },
});

const username = z
  .string()
  .trim()
  .min(3, 'must be at least 3 characters')
  .max(30, 'must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'can only use letters, numbers, dot, dash and underscore');
const password = z.string().min(8, 'must be at least 8 characters').max(200);

async function currentUser(req) {
  const user = await User.findById(req.userId);
  if (!user) throw unauthorized('Account no longer exists', { sessionExpired: true });
  return user;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post(
  '/register',
  credentialLimiter,
  validate({ body: z.object({ username, email: z.email('is not a valid email'), password }) }),
  async (req, res) => {
    const { username: name, email, password: pw } = req.valid.body;
    const lower = email.toLowerCase();
    const taken = await User.findOne({
      $or: [{ email: lower }, { username: new RegExp(`^${escapeRegex(name)}$`, 'i') }],
    });
    if (taken) {
      throw conflict(taken.email === lower ? 'That email is already registered' : 'That username is taken');
    }
    const user = await User.create({ username: name, email: lower, password: await bcrypt.hash(pw, 12) });
    res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
  }
);

router.post(
  '/login',
  credentialLimiter,
  validate({
    body: z
      .object({ identifier: z.string().trim().optional(), email: z.string().trim().optional(), password: z.string().min(1) })
      .refine((b) => b.identifier || b.email, 'Enter your email or username'),
  }),
  async (req, res) => {
    const id = (req.valid.body.identifier || req.valid.body.email).trim();
    const query = id.includes('@')
      ? { email: id.toLowerCase() }
      : { username: new RegExp(`^${escapeRegex(id)}$`, 'i') };
    const user = await User.findOne(query).select('+password');
    // Same message either way so the endpoint can't be used to probe accounts.
    if (!user || !(await bcrypt.compare(req.valid.body.password, user.password))) {
      throw unauthorized('Wrong email/username or password');
    }
    res.json({ token: signToken(user._id), user: user.toPublic() });
  }
);

router.get('/me', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  res.json({ user: user.toPublic() });
});

router.patch(
  '/me',
  requireAuth,
  validate({
    body: z.object({
      username: username.optional(),
      settings: z.object({ includeSpecials: z.boolean().optional() }).optional(),
    }),
  }),
  async (req, res) => {
    const user = await currentUser(req);
    const { username: name, settings } = req.valid.body;
    if (name && name.toLowerCase() !== user.username.toLowerCase()) {
      const taken = await User.exists({ username: new RegExp(`^${escapeRegex(name)}$`, 'i') });
      if (taken) throw conflict('That username is taken');
    }
    if (name) user.username = name;
    if (settings?.includeSpecials !== undefined) user.settings.includeSpecials = settings.includeSpecials;
    await user.save();
    res.json({ user: user.toPublic() });
  }
);

router.post(
  '/me/password',
  requireAuth,
  credentialLimiter,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: password }) }),
  async (req, res) => {
    const user = await User.findById(req.userId).select('+password');
    if (!user) throw notFound('Account not found');
    if (!(await bcrypt.compare(req.valid.body.currentPassword, user.password))) {
      throw badRequest('Current password is incorrect');
    }
    user.password = await bcrypt.hash(req.valid.body.newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated' });
  }
);

router.delete(
  '/me',
  requireAuth,
  credentialLimiter,
  validate({ body: z.object({ password: z.string().min(1) }) }),
  async (req, res) => {
    const user = await User.findById(req.userId).select('+password');
    if (!user) throw notFound('Account not found');
    if (!(await bcrypt.compare(req.valid.body.password, user.password))) {
      throw badRequest('Password is incorrect');
    }
    await Show.deleteMany({ userId: user._id });
    await History.deleteMany({ userId: user._id });
    await user.deleteOne();
    res.json({ message: 'Account deleted' });
  }
);

module.exports = router;
