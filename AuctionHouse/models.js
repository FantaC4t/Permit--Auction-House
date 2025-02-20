const mongoose = require("mongoose");

// Permit Schema
const PermitSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String }
});

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  coins: { type: Number, default: 100 }
});

// Bid Schema
const BidSchema = new mongoose.Schema({
  permit: { type: mongoose.Schema.Types.ObjectId, ref: "Permit", required: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  bidTime: { type: Date, default: Date.now }
});

// Bids Team Schema
const BidsTeamSchema = new mongoose.Schema({
  bid: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
  teamMember: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
});

// Invite Schema
const InviteSchema = new mongoose.Schema({
  permit: { type: mongoose.Schema.Types.ObjectId, ref: "Permit", required: true },
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
});

// Export Models
const Permit = mongoose.model("Permit", PermitSchema);
const User = mongoose.model("User", UserSchema);
const Bid = mongoose.model("Bid", BidSchema);
const BidsTeam = mongoose.model("BidsTeam", BidsTeamSchema);
const Invite = mongoose.model("Invite", InviteSchema);

module.exports = { Permit, User, Bid, BidsTeam, Invite };
