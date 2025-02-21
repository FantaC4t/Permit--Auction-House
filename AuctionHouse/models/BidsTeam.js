const mongoose = require("mongoose");

const BidsTeamSchema = new mongoose.Schema({
  bid: { type: mongoose.Schema.Types.ObjectId, ref: "Bid", required: true },
  teamMember: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
});

module.exports = mongoose.model("BidsTeam", BidsTeamSchema);