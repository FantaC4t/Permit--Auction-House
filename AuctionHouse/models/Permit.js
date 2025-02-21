const mongoose = require("mongoose");

const PermitSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  highest_bid: { type: Number, default: 0 },
  bids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bid" }]
});

module.exports = mongoose.model("Permit", PermitSchema);