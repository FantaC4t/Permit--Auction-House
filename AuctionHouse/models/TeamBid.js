const mongoose = require('mongoose');

const TeamBidSchema = new mongoose.Schema({
  permitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permit',
    required: true
  },
  teamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    contribution: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'complete', 'refunded'],
      default: 'pending'
    }
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'complete', 'failed', 'refunded'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TeamBid', TeamBidSchema);