const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/auth');
const bidController = require('../controllers/bidController');

router.post('/place/:permitId', isAuthenticated, bidController.placeBid);
router.get('/mybids', isAuthenticated, bidController.getUserBids);

module.exports = router;