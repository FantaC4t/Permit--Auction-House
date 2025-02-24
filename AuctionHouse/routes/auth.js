const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Bid = require('../models/Bid');

// Render Login Page
router.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

// Handle Login
router.post("/login", authController.login);

// Handle Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

module.exports = router;