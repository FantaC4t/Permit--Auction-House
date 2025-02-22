const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const connectDB = require("./db");
const bcrypt = require("bcrypt");
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const User = require("./models/User");
const Permit = require("./models/Permit");
const Bid = require("./models/Bid");
const Invite = require("./models/Invite"); // Import the Invite model

const app = express();
const server = http.createServer(app);

// 1. Static files
const buildPath = path.resolve(__dirname, 'auction-house-client', 'build');
app.use(express.static(buildPath));
app.use('/static', express.static(path.join(buildPath, 'static')));

app.set("view engine", "ejs");
app.use(express.static("public"));

// 2. Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
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

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Session:', req.session);
  next();
});

// 3. API routes
// Render Login Page
app.get("/login", (req, res) => {
  res.render("login", { errorMessage: null });
});

// Update the login route
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user) {
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        req.session.user = user;

        // Fetch and store user bids in session
        const userBids = await Bid.find({ bidder: user._id });
        req.session.user.bids = userBids.reduce((acc, bid) => {
          acc[bid.permit] = bid.amount;
          return acc;
        }, {});

        return res.json({
          success: true,
          user: {
            _id: user._id,
            username: user.username,
            coins: user.coins,
            bids: req.session.user.bids
          }
        });
      }
    }

    return res.status(401).json({ success: false, message: "Invalid username or password" });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: "Server error" });
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

  // Emit event to update clients
  io.emit('bidPlaced', { permitId, bidAmount, user });

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

// Add these routes after your existing routes

// Get all permits
app.get("/permits", isAuthenticated, async (req, res) => {
  try {
    const permits = await Permit.find();
    res.json(permits);
  } catch (error) {
    res.status(500).json({ error: "Error fetching permits" });
  }
});

// Get user data
app.get("/user", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user data" });
  }
});

// Get invites
app.get("/invites", isAuthenticated, async (req, res) => {
  try {
    const invites = await Invite.find({ invitee: req.session.user._id });
    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: "Error fetching invites" });
  }
});

// Get outbid notifications
app.get("/outbid-notifications", isAuthenticated, async (req, res) => {
  try {
    const notifications = req.session.outbidNotifications || [];
    delete req.session.outbidNotifications;
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Error fetching notifications" });
  }
});

const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 4. React app catch-all route (must be last)
app.get('*', (req, res) => {
  console.log(`Serving index.html for ${req.originalUrl}`);
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Change the port number at the bottom of the file
server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
