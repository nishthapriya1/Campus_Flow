import express from 'express';
import Joi from 'joi';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { chatWithAssistant } from '../services/bedrock.service.js';

const router = express.Router();

const chatMessageSchema = Joi.object({
  message: Joi.string().max(500).required().messages({
    'string.max': 'Message cannot exceed 500 characters',
    'any.required': 'Message text is required',
  }),
  history: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().required(),
      })
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'History cannot exceed 10 messages',
    }),
});

// Apply verifyJWT and requireRole to all routes
router.use(verifyJWT);
router.use(requireRole('student'));

// POST /api/chat/message
// Sends academic query to Bedrock chatbot, applying a 10-second request timeout limit.
router.post('/message', async (req, res, next) => {
  try {
    const { error, value } = chatMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
        fields: error.details.map((d) => d.path[0]),
      });
    }

    const { message, history = [] } = value;

    // Call Bedrock with 10-second Promise.race timeout (Requirement 4.2)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error('Assistant session request timed out (limit: 10s)');
        err.status = 503; // Service Unavailable
        reject(err);
      }, 10000)
    );

    let reply;
    try {
      reply = await Promise.race([
        chatWithAssistant(message, history),
        timeoutPromise,
      ]);
    } catch (apiError) {
      // In case of timeout or other Bedrock error, return 503 fallback message
      return res.status(503).json({
        error: 'Assistant temporarily unavailable. Please try again.',
      });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    next(err);
  }
});

export default router;
