const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  inviter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permit',
    required: true
  },
  teamId: {
    type: String,
    required: true
  },
  bidAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'], // Changed from 'accept'/'reject' to 'accepted'/'rejected'
    default: 'pending'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  teamSize: {
    type: Number,
    required: true
  },
  totalTeamBid: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('Invite', InviteSchema);