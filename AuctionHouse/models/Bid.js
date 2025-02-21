const mongoose = require("mongoose");

const BidSchema = new mongoose.Schema({
  permit: { type: mongoose.Schema.Types.ObjectId, ref: "Permit", required: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  bidTime: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Bid", BidSchema);