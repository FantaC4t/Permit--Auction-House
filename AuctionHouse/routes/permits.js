const express = require('express');
const router = express.Router();
const permitController = require('../controllers/permitController');
const { isAuthenticated } = require('../middlewares/auth');
const Permit = require('../models/Permit');
const User = require('../models/User');

// Get all permits
router.get('/', isAuthenticated, permitController.getAllPermits);

// Get bid history for a permit
router.get('/:id/bids', isAuthenticated, permitController.getBidHistory);

// Place a bid
router.post('/:permitId/bid', isAuthenticated, async (req, res) => {
  try {
    // More detailed debugging logs
    console.log('Request body:', req.body);
    console.log('Amount type:', typeof req.body.amount);
    console.log('Raw amount value:', req.body.amount);
    
    // Parse amount, ensuring it's treated as a number
    let amount;
    if (typeof req.body.amount === 'string') {
      amount = parseInt(req.body.amount, 10);
    } else {
      amount = Number(req.body.amount);
    }

    const permitId = req.params.permitId;
    const userId = req.session.user._id;
    
    // Simplified validation with detailed logging
    console.log('Parsed amount:', amount);
    console.log('Is NaN:', isNaN(amount));
    console.log('Is positive:', amount > 0);
    console.log('Is integer:', Number.isInteger(amount));

    if (isNaN(amount)) {
      return res.status(400).json({ 
        error: 'Bid amount must be a valid number',
        received: req.body.amount
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Bid amount must be positive',
        received: amount
      });
    }

    if (!Number.isInteger(amount)) {
      return res.status(400).json({ 
        error: 'Bid amount must be a whole number',
        received: amount
      });
    }
    
    // Get current permit first to check existing bid
    const currentPermit = await Permit.findById(permitId);
    if (!currentPermit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Check if new bid is higher than current bid
    if (amount <= currentPermit.currentBid) {
      return res.status(400).json({ error: 'Bid must be higher than current bid' });
    }

    // Check user's balance
    const user = await User.findById(userId);
    if (!user || user.coins < amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Store previous bid info
    const previousBidAmount = currentPermit.currentBid || 0;
    const previousBidderId = currentPermit.currentBidder;

    // Update permit first
    const updatedPermit = await Permit.findByIdAndUpdate(
      permitId,
      { 
        currentBid: amount,
        currentBidder: userId
      },
      { new: true }
    );

    if (!updatedPermit) {
      return res.status(500).json({ error: 'Failed to update permit' });
    }

    // Update user's balance with validated number
    await User.findByIdAndUpdate(
      userId,
      { $inc: { coins: -amount } }
    );

    // Refund previous bidder if exists with validated number
    if (previousBidderId && previousBidAmount > 0) {
      await User.findByIdAndUpdate(
        previousBidderId,
        { $inc: { coins: previousBidAmount } }
      );
      console.log(`Refunded ${previousBidAmount} coins to individual bidder`);
    }

    res.json(updatedPermit);
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: 'Error placing bid' });
  }
});

module.exports = router;