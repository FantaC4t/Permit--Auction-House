const express = require('express');
const router = express.Router();
const teamBidController = require('../controllers/teamBidController');
const { isAuthenticated } = require('../middlewares/auth'); // Note: middlewares not middleware

router.post('/:teamBidId/respond', isAuthenticated, teamBidController.respondToTeamBid);
router.get('/permit/:permitId', isAuthenticated, teamBidController.getTeamBids);

module.exports = router;