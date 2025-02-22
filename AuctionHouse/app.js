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

  try {
    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: "Permit not found" });
    }

    // Find previous highest bidder to refund their coins
    if (permit.highest_bid) {
      const previousBid = await Bid.findOne({ 
        permit: permitId, 
        amount: permit.highest_bid 
      }).populate('bidder');
      
      if (previousBid && previousBid.bidder._id.toString() !== user._id.toString()) {
        // Refund previous bidder
        const previousBidder = previousBid.bidder;
        previousBidder.coins += permit.highest_bid;
        await previousBidder.save();
        
        // Emit refund event to previous bidder
        io.emit('bidRefunded', {
          userId: previousBidder._id,
          permitId: permit._id,
          refundAmount: permit.highest_bid,
          updatedCoins: previousBidder.coins
        });
      }
    }

    // Create and save the new bid
    const bid = new Bid({
      permit: permitId,
      bidder: user._id,
      amount: bidAmount,
      bidTime: new Date()
    });
    await bid.save();

    // Update permit's highest bid
    const previousBid = permit.highest_bid;
    permit.highest_bid = bidAmount;
    await permit.save();

    // Update bidder's coins
    const updatedUser = await User.findById(user._id);
    updatedUser.coins -= bidAmount;
    await updatedUser.save();
    req.session.user.coins = updatedUser.coins;

    // Emit bid placed event
    io.emit('bidPlaced', {
      permitId: permit._id,
      bidAmount: bidAmount,
      bidder: user._id,
      previousBid: previousBid,
      updatedCoins: updatedUser.coins
    });

    res.json({
      success: true,
      updatedCoins: updatedUser.coins,
      highestBid: bidAmount
    });
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: "Error placing bid" });
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
    const invites = await Invite.find({ invitee: req.session.user._id })
      .populate('inviter', 'username')
      .populate('permit', 'name');
    res.json(invites);
  } catch (error) {
    res.status(500).json({ error: "Error fetching invites" });
  }
});

// Fix the syntax error in the error handling
app.get('/outbid-notifications', isAuthenticated, async (req, res) => {
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
