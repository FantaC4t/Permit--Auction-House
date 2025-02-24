const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const User = require("./models/User");
const Permit = require("./models/Permit");
const Bid = require("./models/Bid");
const Invite = require("./models/Invite"); // Import the Invite model
const TeamBid = require("./models/TeamBid");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO before using it
const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available to routes
app.io = io;

// Socket.IO connection handling
io.on('connection', (socket) => {
  socket.on('joinRoom', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('leaveRoom', (userId) => {
    socket.leave(userId);
    console.log(`User ${userId} left their room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Add these near the top of your app.js, after creating the app
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// 1. Static files
const buildPath = path.resolve(__dirname, 'auction-house-client', 'build');
app.use(express.static(buildPath));
app.use('/static', express.static(path.join(buildPath, 'static')));

app.set("view engine", "ejs");
app.use(express.static("public"));

// 2. Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  })
);

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/auction-house', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: false // Add this line
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

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

app.use('/auth', authRoutes);

const permitRoutes = require('./routes/permits');
app.use('/permits', permitRoutes);

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

app.use((req, res, next) => {
  res.locals.success = req.session.success;
  res.locals.error = req.session.error;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Add these routes after your existing routes

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
    res.json(invites || []);
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

app.get('/check-user/:username', isAuthenticated, async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username: username });
    
    // Don't allow self-invitation
    if (user && user._id.toString() === req.session.user._id.toString()) {
      return res.json({ exists: false });
    }
    
    res.json({ exists: !!user });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ error: 'Error checking user' });
  }
});

app.get('/invite/:teamId/status', isAuthenticated, async (req, res) => {
  try {
    const { teamId } = req.params;
    const invites = await Invite.find({ teamId }).populate('invitee');
    res.json({ 
      totalInvites: invites.length,
      acceptedInvites: invites.filter(i => i.status === 'accepted').length,
      invites
    });
  } catch (error) {
    console.error('Error getting invite status:', error);
    res.status(500).json({ error: 'Error getting invite status' });
  }
});

const teamBidRoutes = require('./routes/teamBids');
app.use('/team-bids', teamBidRoutes);

const teamRoutes = require('./routes/teams');
app.use('/teams', teamRoutes);

// 4. React app catch-all route (must be last)
app.get('*', (req, res) => {
  console.log(`Serving index.html for ${req.originalUrl}`);
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Change the port number at the bottom of the file
server.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
