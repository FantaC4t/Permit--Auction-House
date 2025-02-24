const User = require('../models/User');
const bcrypt = require('bcrypt');
const Bid = require('../models/Bid');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username }); // Debug log

    // Input validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide username and password" 
      });
    }

    // Find user
    const user = await User.findOne({ username });
    console.log('User found:', user ? 'yes' : 'no'); // Debug log

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch); // Debug log

    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Get user's bids
    const userBids = await Bid.find({ bidder: user._id });
    const bidsMap = userBids.reduce((acc, bid) => {
      acc[bid.permit.toString()] = bid.amount;
      return acc;
    }, {});

    // Set session
    req.session.user = {
      _id: user._id,
      username: user.username,
      coins: user.coins,
      bids: bidsMap
    };

    await req.session.save(); // Ensure session is saved

    console.log('Login successful:', { username, sessionId: req.session.id }); // Debug log

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        coins: user.coins,
        bids: bidsMap
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Server error during login" 
    });
  }
};