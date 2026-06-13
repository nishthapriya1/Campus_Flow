import express from 'express';
import Joi from 'joi';
import { verifyJWT } from '../middleware/auth.js';
import PushSubscription from '../models/PushSubscription.js';

const router = express.Router();

const subscribeSchema = Joi.object({
  endpoint: Joi.string().uri().optional(),
  keys: Joi.object({
    p256dh: Joi.string().required(),
    auth: Joi.string().required(),
  }).optional(),
  subscription: Joi.object({
    endpoint: Joi.string().uri().required(),
    keys: Joi.object({
      p256dh: Joi.string().required(),
      auth: Joi.string().required(),
    }).required(),
  }).optional(),
  userAgent: Joi.string().allow('').optional(),
});

const unsubscribeSchema = Joi.object({
  endpoint: Joi.string().uri().required(),
});

// POST /api/push/subscribe (verifyJWT)
router.post('/subscribe', verifyJWT, async (req, res, next) => {
  try {
    const { error, value } = subscribeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let endpoint, p256dh, auth;
    if (value.subscription) {
      endpoint = value.subscription.endpoint;
      p256dh = value.subscription.keys.p256dh;
      auth = value.subscription.keys.auth;
    } else if (value.endpoint && value.keys) {
      endpoint = value.endpoint;
      p256dh = value.keys.p256dh;
      auth = value.keys.auth;
    } else {
      return res.status(400).json({ error: 'Valid subscription data (endpoint and keys) is required.' });
    }

    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: req.user.userId,
        keys: { p256dh, auth },
        userAgent: value.userAgent || req.headers['user-agent'] || '',
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ success: true, subscription: sub });
  } catch (err) {
    next(err);
  }
});

// POST /api/push/unsubscribe (verifyJWT)
router.post('/unsubscribe', verifyJWT, async (req, res, next) => {
  try {
    const { error, value } = unsubscribeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await PushSubscription.deleteOne({
      endpoint: value.endpoint,
      userId: req.user.userId,
    });

    return res.status(200).json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
});

// GET /api/push/vapid-public-key (public)
router.get('/vapid-public-key', (req, res) => {
  return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

export default router;
