const mongoose = require('mongoose');
const Permit = require('../models/Permit');
const Bid = require('../models/Bid');
const User = require('../models/User');
const TeamBid = require('../models/TeamBid');
const { refundTeamBid } = require('../services/bidService');

exports.getAllPermits = async (req, res) => {
  try {
    const permits = await Permit.find();
    res.json(permits || []);
  } catch (error) {
    console.error('Error fetching permits:', error);
    res.status(500).json({ error: "Error fetching permits" });
  }
};

exports.getBidHistory = async (req, res) => {
  try {
    const permitId = req.params.id;
    const permit = await Permit.findById(permitId);
    
    if (!permit) {
      return res.status(404).json({ 
        bids: [],
        error: "Permit not found" 
      });
    }

    const bids = await Bid.find({ permit: permitId })
      .populate('bidder', 'username')
      .sort({ bidTime: -1 });

    res.json({ bids: bids || [] });
  } catch (error) {
    console.error('Error fetching bid history:', error);
    res.status(500).json({ 
      bids: [],
      error: "Error fetching bid history" 
    });
  }
};

exports.placeBid = async (req, res) => {
  let session;
  try {
    const permitId = req.params.id;
    const bidAmount = parseInt(req.body.bid_amount);
    const user = req.session.user;

    // Input validation
    if (!bidAmount || isNaN(bidAmount)) {
      return res.status(400).json({ error: "Invalid bid amount" });
    }

    const permit = await Permit.findById(permitId);
    if (!permit) {
      return res.status(404).json({ error: "Permit not found" });
    }

    const currentUser = await User.findById(user._id);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate user has enough coins
    if (currentUser.coins < bidAmount) {
      return res.status(400).json({ error: "Insufficient coins" });
    }

    // Check if bid is higher than current highest
    if (permit.highest_bid && bidAmount <= permit.highest_bid) {
      return res.status(400).json({ error: "Bid must be higher than current highest bid" });
    }

    // Start transaction
    session = await mongoose.startSession();
    await session.startTransaction();

    try {
      // Process bid refunds if necessary
      await refundTeamBid(permitId, bidAmount, req.app.io);

      // Create new bid
      const bid = new Bid({
        permit: permitId,
        bidder: user._id,
        amount: bidAmount,
        bidTime: new Date()
      });
      await bid.save({ session });

      // Update user's coins
      currentUser.coins -= bidAmount;
      await currentUser.save({ session });

      // Update permit's highest bid
      permit.highest_bid = bidAmount;
      await permit.save({ session });

      // Commit transaction
      await session.commitTransaction();

      // Update session
      req.session.user.coins = currentUser.coins;

      // Emit bid placed event
      req.app.io.emit('bidPlaced', {
        permitId: permit._id,
        bidAmount: bidAmount,
        bidder: user._id,
        updatedCoins: currentUser.coins
      });

      res.json({
        success: true,
        updatedCoins: currentUser.coins,
        highestBid: bidAmount
      });

    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      throw error;
    }

  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: error.message || "Error placing bid" });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};