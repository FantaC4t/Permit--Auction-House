const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { isAuthenticated } = require('../middlewares/auth');

router.post('/invite/:permitId', isAuthenticated, teamController.createInvite);
router.post('/invite/:inviteId/respond', isAuthenticated, teamController.respondToInvite);
router.get('/invites', isAuthenticated, teamController.getInvites);

module.exports = router;