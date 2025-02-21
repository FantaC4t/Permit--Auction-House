const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const connectDB = require("./db");
const crypto = require('crypto');

const User = require("./models/User"); // Ensure the correct path to the User model
const Permit = require("./models/Permit");
const Bid = require("./models/Bid");
const Invite = require("./models/Invite");
const BidsTeam = require("./models/BidsTeam");

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
  })
);

// Connect to MongoDB
connectDB();

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect("/login");
}

// Render Login Page
app.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

// Handle Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", username, password); // Debugging statement

  const user = await User.findOne({ username });
  console.log("User found:", user); // Debugging statement

  if (user) {
    console.log("User password field:", user.password); // Debugging statement
    console.log("Comparing passwords:", password, user.password); // Debugging statement
    if (password === user.password) {
      req.session.user = user; // Store user in session
      console.log("Login successful"); // Debugging statement
      res.json({ success: true });
    } else {
      console.log("Invalid Password."); // Debugging statement
      res.status(401).json({ message: "Invalid Username or Password." });
    }
  } else {
    console.log("User not found."); // Debugging statement
    res.status(401).json({ message: "Invalid Username or Password." });
  }
});

// Handle Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Permit Shop Route (Protected)
app.get("/", isAuthenticated, async (req, res) => {
  const permits = await Permit.find();
  const invites = await Invite.find({ invitee: req.session.user._id });
  res.render("permit-shop", {
    user: req.session.user,
    permits,
    userBids: req.session.user.bids || {},
    invites,
  });
});

// Handle Bidding
app.post("/bid/:id", isAuthenticated, async (req, res) => {
  const permitId = req.params.id;
  const bidAmount = parseInt(req.body.bid_amount);
  const user = req.session.user;

  if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
    return res.redirect("/?error=Invalid%20bid%20amount");
  }

  if (bidAmount > user.coins) {
    return res.redirect("/?error=Not%20enough%20coins");
  }

  const permit = await Permit.findById(permitId);
  if (!permit) {
    return res.redirect("/?error=Permit%20not%20found");
  }

  if (bidAmount > permit.highest_bid) {
    permit.highest_bid = bidAmount;
    await permit.save();

    user.coins -= bidAmount;
    await User.findByIdAndUpdate(user._id, { coins: user.coins });

    const bid = new Bid({
      permit: permitId,
      bidder: user._id,
      amount: bidAmount
    });
    await bid.save();

    req.session.user.bids = { ...req.session.user.bids, [permitId]: bidAmount };
    req.session.success = "Bid placed successfully!";
    return res.redirect("/");
  } else {
    req.session.error = "Your bid must be higher than the current highest bid!";
    return res.redirect("/");
  }
});

app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Handle Sending an Invite with Cost Calculation
app.post("/invite/:permitId", isAuthenticated, async (req, res) => {
  const permitId = req.params.permitId;
  const invitedUser = req.body.invitedUser; // Who is being invited
  const inviter = req.session.user._id; // Who is inviting

  const permit = await Permit.findById(permitId);
  if (!permit) {
    return res.redirect("/?error=Permit%20not%20found");
  }

  // Store invite correctly
  const invite = new Invite({
    permit: permitId,
    inviter,
    invitee: invitedUser,
    status: "pending"
  });
  await invite.save();

  return res.redirect("/?success=Invite%20sent%20to%20" + invitedUser);
});

// Accept/Reject Invites
app.post("/accept_invite/:id", isAuthenticated, async (req, res) => {
  await Invite.findByIdAndDelete(req.params.id);
  res.redirect("/");
});

app.post("/reject_invite/:id", isAuthenticated, async (req, res) => {
  await Invite.findByIdAndDelete(req.params.id);
  res.redirect("/");
});

// Route to display all bids for a specific permit
app.get("/permit/:id/bids", isAuthenticated, async (req, res) => {
  const permitId = req.params.id;
  const permit = await Permit.findById(permitId).populate('bids');
  if (!permit) {
    return res.redirect("/?error=Permit%20not%20found");
  }

  const bids = await Bid.find({ permit: permitId }).populate('bidder').sort({ bidTime: -1 });
  res.render("permit-bids", {
    user: req.session.user,
    permit,
    bids
  });
});

// Start Server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
