const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  permit: { type: mongoose.Schema.Types.ObjectId, ref: "Permit", required: true },
  inviter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  invitee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" }
});

module.exports = mongoose.model("Invite", InviteSchema);