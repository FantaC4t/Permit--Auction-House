const Bid = require('../models/Bid');
const User = require('../models/User');
const Permit = require('../models/Permit');

const bidController = {
    placeBid: async (req, res) => {
        try {
            const { amount } = req.body;
            const permitId = req.params.permitId;
            const userId = req.session.user._id;

            // Get current permit using findOne instead of findById
            const permit = await Permit.findOne({ _id: permitId });
            if (!permit) {
                return res.status(404).json({ error: 'Permit not found' });
            }

            // Check if bid amount is valid
            if (!amount || amount <= permit.currentBid) {
                return res.status(400).json({ 
                    error: 'Bid must be higher than current bid' 
                });
            }

            // Get user and check balance using findOne
            const user = await User.findOne({ _id: userId });
            if (!user || user.coins < amount) {
                return res.status(400).json({ 
                    error: 'Insufficient funds' 
                });
            }

            // Store previous bid info
            const previousBidAmount = permit.currentBid;
            const previousBidderId = permit.currentBidder;

            // Update permit first
            const updatedPermit = await Permit.findOneAndUpdate(
                { _id: permitId },
                { 
                    currentBid: amount,
                    currentBidder: userId
                },
                { new: true }
            );

            if (!updatedPermit) {
                return res.status(500).json({ error: 'Failed to update permit' });
            }

            // Update user's balance
            const updatedUser = await User.findOneAndUpdate(
                { _id: userId },
                { $inc: { coins: -amount } },
                { new: true }
            );

            if (!updatedUser) {
                // Rollback permit update if user update fails
                await Permit.findOneAndUpdate(
                    { _id: permitId },
                    { 
                        currentBid: previousBidAmount,
                        currentBidder: previousBidderId
                    }
                );
                return res.status(500).json({ error: 'Failed to update user balance' });
            }

            // Create new bid
            const newBid = await Bid.create({
                amount,
                user: userId,
                permit: permitId
            });

            // Refund previous bidder if exists
            if (previousBidderId) {
                await User.findOneAndUpdate(
                    { _id: previousBidderId },
                    { $inc: { coins: previousBidAmount } }
                );
                console.log(`Refunded ${previousBidAmount} coins to individual bidder`);
            }

            res.status(201).json({ 
                message: 'Bid placed successfully', 
                bid: newBid 
            });

        } catch (error) {
            console.error('Error placing bid:', error);
            res.status(500).json({ error: 'Error placing bid' });
        }
    },

    getUserBids: async (req, res) => {
        try {
            const bids = await Bid.find({ user: req.session.user._id })
                .populate('permit')
                .sort({ createdAt: -1 });
            res.json(bids);
        } catch (error) {
            console.error('Error fetching bids:', error);
            res.status(500).json({ error: 'Error fetching bids' });
        }
    }
};

module.exports = bidController;