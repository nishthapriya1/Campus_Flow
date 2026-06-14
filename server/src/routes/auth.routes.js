import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import User from '../models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cf_secret_fallback_key_32_chars_long';

// RFC 5322 compliant regex for email validation in Joi
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const registerSchema = Joi.object({
  email: Joi.string().pattern(emailRegex).required().messages({
    'string.pattern.base': 'Please provide a valid email address conforming to RFC 5322',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be between 8 and 128 characters long',
    'string.max': 'Password must be between 8 and 128 characters long',
    'any.required': 'Password is required'
  }),
  name: Joi.string().required().messages({
    'any.required': 'Name is required'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().pattern(emailRegex).required().messages({
    'string.pattern.base': 'Please provide a valid email address conforming to RFC 5322',
    'any.required': 'Email is required'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  })
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message, 
        fields: error.details.map(d => d.path[0]) 
      });
    }

    const { email, password, name } = value;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // Hash password with bcrypt cost factor 12
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = new User({
      email,
      passwordHash,
      name,
      role: 'student'
    });

    await newUser.save();

    return res.status(201).json({
      userId: newUser._id,
      email: newUser.email,
      role: newUser.role
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message, 
        fields: error.details.map(d => d.path[0]) 
      });
    }

    const { email, password } = value;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'INVALID_PASSWORD' });
    }

    // Issue JWT - 8 hour expiry (28800 seconds)
    const token = jwt.sign(
      { userId: user._id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      token,
      expiresIn: 28800,
      user: {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
