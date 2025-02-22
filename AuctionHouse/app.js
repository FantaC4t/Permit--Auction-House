const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const connectDB = require("./db");
const bcrypt = require("bcrypt");

const User = require("./models/User");
const Permit = require("./models/Permit");
const Bid = require("./models/Bid");
const Invite = require("./models/Invite"); // Import the Invite model

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

  const user = await User.findOne({ username });

  if (user) {
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      req.session.user = user; // Store user in session

      // Check for outbid notifications
      req.sessionStore.get(user._id.toString(), (err, session) => {
        if (session && session.outbidNotifications) {
          req.session.outbidNotifications = session.outbidNotifications;
          delete session.outbidNotifications;
          req.sessionStore.set(user._id.toString(), session);
        }
      });

      return res.redirect("/"); // Redirect to permit shop
    } else {
      return res.render("login", { errorMessage: "Invalid Username or Password." });
    }
  } else {
    return res.render("login", { errorMessage: "Invalid Username or Password." });
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
  const outbidNotifications = req.session.outbidNotifications || [];
  delete req.session.outbidNotifications; // Clear notifications after fetching

  res.render("permit-shop", {
    user: req.session.user,
    permits,
    userBids: req.session.user.bids || {},
    invites,
    outbidNotifications
  });
});

// Handle Bidding
app.post("/bid/:id", isAuthenticated, async (req, res) => {
  const permitId = req.params.id;
  const bidAmount = parseInt(req.body.bid_amount);
  const user = req.session.user;

  if (!bidAmount || isNaN(bidAmount) || bidAmount <= 0) {
    return res.status(400).json({ error: "Invalid bid amount" });
  }

  if (bidAmount > user.coins) {
    return res.status(400).json({ error: "Not enough coins" });
  }

  const permit = await Permit.findById(permitId).populate('bids');
  if (!permit) {
    return res.status(404).json({ error: "Permit not found" });
  }

  const existingBids = await Bid.find({ permit: permitId }).sort({ amount: -1 });

  if (existingBids.length > 0) {
    const highestBid = existingBids[0];
    if (bidAmount <= highestBid.amount) {
      return res.status(400).json({ error: "Your new bid must be higher than the current highest bid" });
    }

    // Refund the previous highest bidder
    const previousHighestBidder = await User.findById(highestBid.bidder);
    if (previousHighestBidder._id.equals(user._id)) {
      // If the user is outbidding themselves, refund their previous bid amount
      user.coins += highestBid.amount;
    } else {
      previousHighestBidder.coins += highestBid.amount;
      await User.findByIdAndUpdate(previousHighestBidder._id, { coins: previousHighestBidder.coins });

      // Store outbid information in the previous highest bidder's session
      req.sessionStore.get(previousHighestBidder._id.toString(), (err, session) => {
        if (session) {
          session.outbidNotifications = session.outbidNotifications || [];
          session.outbidNotifications.push({
            permitName: permit.name,
            bidAmount: highestBid.amount,
          });
          req.sessionStore.set(previousHighestBidder._id.toString(), session);
        }
      });
    }
  }

  permit.highest_bid = bidAmount;

  const bid = new Bid({
    permit: permitId,
    bidder: user._id,
    amount: bidAmount
  });
  await bid.save();

  permit.bids.push(bid._id);
  await permit.save();

  user.coins -= bidAmount;
  await User.findByIdAndUpdate(user._id, { coins: user.coins });

  req.session.user.bids = { ...req.session.user.bids, [permitId]: bidAmount };
  req.session.success = "Bid placed successfully!";
  return res.json({ success: "Bid placed successfully!", updatedCoins: user.coins, highestBid: bidAmount });
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
  const invitedUsername = req.body.invitedUser; // Who is being invited
  const inviter = req.session.user._id; // Who is inviting

  const permit = await Permit.findById(permitId);
  if (!permit) {
    return res.redirect("/?error=Permit%20not%20found");
  }

  const invitedUser = await User.findOne({ username: invitedUsername });
  if (!invitedUser) {
    return res.redirect("/?error=User%20not%20found");
  }

  // Store invite correctly
  const invite = new Invite({
    permit: permitId,
    inviter,
    invitee: invitedUser._id,
    status: "pending"
  });
  await invite.save();

  return res.redirect("/?success=Invite%20sent%20to%20" + invitedUsername);
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
    return res.status(404).json({ error: "Permit not found" });
  }

  const bids = await Bid.find({ permit: permitId }).populate('bidder').sort({ bidTime: -1 });
  res.json({ bids });
});

// Start Server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
