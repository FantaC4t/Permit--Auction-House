const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Bid = require('../models/Bid');

// Debug middleware for auth routes
router.use((req, res, next) => {
  console.log(`[Auth Route] ${req.method} ${req.path}`);
  next();
});

// Login endpoint - /api/auth/login
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username }).select('+password');
    console.log('User lookup result:', user ? 'Found' : 'Not found');

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    console.log('Password verification:', isValid ? 'Success' : 'Failed');

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Save session before sending response
    req.session.user = {
      _id: user._id,
      username: user.username,
      coins: user.coins
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        coins: user.coins
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error during login' });
  }
});

// Handle Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully' });
  });
});

// Move checkSession middleware before protected routes
const checkSession = (req, res, next) => {
  console.log('Checking session:', req.session);
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Add session check to protected routes
router.use(checkSession);

module.exports = router;