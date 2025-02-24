const express = require('express');
const router = express.Router();
const permitController = require('../controllers/permitController');
const { isAuthenticated } = require('../middlewares/auth');

// Get all permits
router.get('/', isAuthenticated, permitController.getAllPermits);

// Get bid history for a permit
router.get('/:id/bids', isAuthenticated, permitController.getBidHistory);

// Place a bid
router.post('/:id/bid', isAuthenticated, permitController.placeBid);

module.exports = router;