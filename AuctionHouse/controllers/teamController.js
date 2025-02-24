const mongoose = require('mongoose');
const TeamBid = require('../models/TeamBid');
const Invite = require('../models/Invite');
const User = require('../models/User');
const Permit = require('../models/Permit');

exports.createInvite = async (req, res) => {
  try {
    const { permitId } = req.params;
    const { invitedUsers, bidAmount } = req.body;

    if (!invitedUsers || !Array.isArray(invitedUsers) || !bidAmount) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const teamId = new mongoose.Types.ObjectId();
    const teamSize = invitedUsers.length + 1;
    const totalTeamBid = bidAmount * teamSize;

    const invitePromises = invitedUsers.map(async (username) => {
      const invitedUser = await User.findOne({ username });
      if (!invitedUser) {
        throw new Error(`User ${username} not found`);
      }

      const invite = new Invite({
        inviter: req.session.user._id,
        invitee: invitedUser._id,
        permit: permitId,
        bidAmount,
        totalTeamBid,
        teamSize,
        teamId,
        status: 'pending'
      });

      await invite.save();

      const populatedInvite = await Invite.findById(invite._id)
        .populate('inviter', 'username')
        .populate('permit', 'name');

      req.app.io.to(invitedUser._id.toString()).emit('newInvite', populatedInvite);

      return populatedInvite;
    });

    const createdInvites = await Promise.all(invitePromises);

    res.json({ 
      success: true, 
      message: `Sent ${invitedUsers.length} invites successfully`,
      invites: createdInvites
    });

  } catch (error) {
    console.error('Error creating invites:', error);
    res.status(500).json({ error: 'Error creating invites' });
  }
};

exports.respondToInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { action } = req.body;

    console.log('Responding to invite:', inviteId, 'with action:', action); // Debug log

    const statusMap = { 'accept': 'accepted', 'reject': 'rejected' };
    const newStatus = statusMap[action];

    if (!newStatus) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const invite = await Invite.findById(inviteId)
      .populate('inviter')
      .populate('permit')
      .populate('invitee');

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.invitee._id.toString() !== req.session.user._id) {
      return res.status(403).json({ error: 'Not authorized to respond to this invite' });
    }

    invite.status = newStatus;
    await invite.save();

    if (newStatus === 'accepted') {
      const teamInvites = await Invite.find({ 
        teamId: invite.teamId,
        status: 'accepted'
      }).populate('invitee').populate('inviter');

      const totalInvites = await Invite.countDocuments({ teamId: invite.teamId });

      if (teamInvites.length === totalInvites) {
        // Process team bid creation
        const totalAmount = teamInvites.reduce((sum, inv) => sum + inv.bidAmount, 0);

        // Deduct coins from team members
        const updatePromises = teamInvites.map(async (inv) => {
          const member = await User.findById(inv.invitee._id);
          member.coins -= inv.bidAmount;
          return member.save();
        });

        // Deduct from team leader
        const teamLeader = await User.findById(invite.inviter._id);
        teamLeader.coins -= invite.bidAmount;
        updatePromises.push(teamLeader.save());

        await Promise.all(updatePromises);

        // Create team bid
        const teamBid = new TeamBid({
          permitId: invite.permit._id,
          teamLeader: invite.inviter._id,
          members: [
            {
              user: invite.inviter._id,
              contribution: invite.bidAmount,
              status: 'accepted'
            },
            ...teamInvites.map(inv => ({
              user: inv.invitee._id,
              contribution: inv.bidAmount,
              status: 'accepted'
            }))
          ],
          totalAmount: totalAmount + invite.bidAmount,
          status: 'complete'
        });

        await teamBid.save();

        // Update permit highest bid
        await Permit.findByIdAndUpdate(
          invite.permit._id,
          { $max: { highest_bid: teamBid.totalAmount } }
        );

        // Notify all team members
        const members = [...teamInvites.map(inv => inv.invitee._id), invite.inviter._id];
        members.forEach(memberId => {
          req.app.io.to(memberId.toString()).emit('teamBidComplete', {
            permitId: invite.permit._id,
            teamId: invite.teamId,
            totalAmount: teamBid.totalAmount
          });
        });
      }
    }

    res.json({ 
      success: true, 
      message: `Invite ${action}ed successfully` 
    });

  } catch (error) {
    console.error('Error handling invite response:', error);
    res.status(500).json({ error: 'Error processing invite response' });
  }
};

exports.getTeamBids = async (req, res) => {
  try {
    const { permitId } = req.params;
    const teamBids = await TeamBid.find({ permitId })
      .populate('members.user', 'username')
      .populate('teamLeader', 'username')
      .sort({ createdAt: -1 });

    res.json({ teamBids: teamBids || [] });
  } catch (error) {
    console.error('Error fetching team bids:', error);
    res.status(500).json({ teamBids: [], error: 'Error fetching team bids' });
  }
};

// Add this new method to the exports
exports.getInvites = async (req, res) => {
  try {
    const invites = await Invite.find({ invitee: req.session.user._id })
      .populate('inviter', 'username')
      .populate('permit', 'name')
      .sort({ createdAt: -1 });

    res.json(invites || []);
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Error fetching invites' });
  }
};