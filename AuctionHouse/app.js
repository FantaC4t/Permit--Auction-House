console.log("Starting the server...");
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Simulated Database
let user = { username: "JohnDoe", coins: 100 };
let permits = [
  { id: 1, name: "Parking Permit A", description: "Valid for zone A", highest_bid: 50, highest_bidder: null },
  { id: 2, name: "Construction Permit B", description: "For small buildings", highest_bid: 75, highest_bidder: null },
];
let userBids = {};
let invites = [
  { invite_id: 1, inviter_username: "Alice", permit_name: "Parking Permit A", status: "pending" }
];

// Render Permit Shop Page
app.get("/", (req, res) => {
  res.render("permit-shop", {
    user,
    permits,
    userBids,
    invites,
  });
});

// Handle Bids
app.post("/bid/:id", (req, res) => {
    const permitId = parseInt(req.params.id);
    const bidAmount = parseInt(req.body.bid_amount);
  
    console.log("Received bid:", { permitId, bidAmount, body: req.body });
  
    if (!bidAmount || isNaN(bidAmount)) {
      return res.redirect("/?error=Invalid%20bid%20amount");
    }
  
    userBids[permitId] = bidAmount;
    res.redirect("/?success=Bid%20placed%20successfully");
  });
  
// Accept/Reject Invites
app.post("/accept_invite/:id", (req, res) => {
    const inviteId = parseInt(req.params.id);
    const invite = invites.find(inv => inv.invite_id === inviteId);
  
    if (!invite) {
      return res.redirect("/?error=Invite not found!");
    }
  
    invites = invites.filter(inv => inv.invite_id !== inviteId);
    return res.redirect("/?success=Invite accepted!");
  });
  
  app.post("/reject_invite/:id", (req, res) => {
    const inviteId = parseInt(req.params.id);
    const invite = invites.find(inv => inv.invite_id === inviteId);
  
    if (!invite) {
      return res.redirect("/?error=Invite not found!");
    }
  
    invites = invites.filter(inv => inv.invite_id !== inviteId);
    return res.redirect("/?success=Invite rejected!");
  });
  
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });