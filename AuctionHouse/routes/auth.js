const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Bid = require('../models/Bid');

// Render Login Page
router.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

// Handle Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Add debug logging
    console.log("Login attempt:", { username });

    const user = await User.findOne({ username });
    
    if (!user) {
      console.log("User not found");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log("Invalid password");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    req.session.userId = user._id;
    console.log("Login successful", { userId: user._id });
    
    res.json({ 
      success: true, 
      user: {
        _id: user._id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Handle Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;