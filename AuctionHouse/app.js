const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const MongoStore = require('connect-mongo');

const User = require("./models/User");
const Permit = require("./models/Permit");
const Bid = require("./models/Bid");
const Invite = require("./models/Invite"); // Import the Invite model
const TeamBid = require("./models/TeamBid");

const authRoutes = require('./routes/auth');
const permitRoutes = require('./routes/permits');
const bidRoutes = require('./routes/bids');
const teamBidRoutes = require('./routes/teamBids');
const teamRoutes = require('./routes/teams');

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

// CORS configuration - must be before routes
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static("public"));

// Consolidated session configuration
app.use(
  session({
    secret: "yourSecretKey",
    resave: true,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: 'mongodb://localhost:27017/auctionDB',
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: 'native'
    }),
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  })
);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/auctionDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  directConnection: true,
  retryWrites: false
}).then(() => {
  console.log('Connected to MongoDB successfully');
  // Start server only after successful connection
  server.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
  });
}).catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit if MongoDB connection fails
});

// Add error handling for MongoDB connection
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

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

// Mount all API routes before static files and catch-all route
app.use('/api/auth', authRoutes);
app.use('/api/permits', permitRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/team-bids', teamBidRoutes);
app.use('/api/teams', teamRoutes);

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
app.get("/api/user", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user data" });
  }
});

// Get invites
app.get("/api/invites", isAuthenticated, async (req, res) => {
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
app.get('/api/outbid-notifications', isAuthenticated, async (req, res) => {
  try {
    const notifications = req.session.outbidNotifications || [];
    delete req.session.outbidNotifications;
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Error fetching notifications" });
  }
});

app.get('/api/check-user/:username', isAuthenticated, async (req, res) => {
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

app.get('/api/invite/:teamId/status', isAuthenticated, async (req, res) => {
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

// Move static file serving after API routes
const buildPath = path.resolve(__dirname, 'auction-house-client', 'build');
app.use(express.static(buildPath));
app.use('/static', express.static(path.join(buildPath, 'static')));

// 6. Catch-all route for React app - Must be last
app.get('*', (req, res) => {
  console.log(`Serving index.html for ${req.originalUrl}`);
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
