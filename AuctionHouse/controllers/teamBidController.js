const TeamBid = require('../models/TeamBid');
const Permit = require('../models/Permit');
const User = require('../models/User');

exports.respondToTeamBid = async (req, res) => {
  try {
    const { teamBidId } = req.params;
    const { action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const teamBid = await TeamBid.findById(teamBidId)
      .populate('permitId')
      .populate('teamLeader');

    if (!teamBid) {
      return res.status(404).json({ error: 'Team bid not found' });
    }

    // Update member status
    const memberIndex = teamBid.members.findIndex(
      m => m.user.toString() === req.session.user._id.toString()
    );

    if (memberIndex === -1) {
      return res.status(403).json({ error: 'Not authorized to respond to this team bid' });
    }

    teamBid.members[memberIndex].status = action;
    await teamBid.save();

    // Check if all members have responded
    const allResponded = teamBid.members.every(m => m.status !== 'pending');
    const allAccepted = teamBid.members.every(m => m.status === 'accepted');

    if (allResponded) {
      if (allAccepted) {
        teamBid.status = 'complete';
        await teamBid.save();

        // Update permit's highest bid if necessary
        await Permit.findByIdAndUpdate(
          teamBid.permitId,
          { $max: { highest_bid: teamBid.totalAmount } }
        );

        // Emit team bid completion event
        req.app.io.emit('teamBidComplete', {
          teamBidId: teamBid._id,
          permitId: teamBid.permitId,
          totalAmount: teamBid.totalAmount
        });
      } else {
        teamBid.status = 'failed';
        await teamBid.save();
      }
    }

    res.json({ 
      success: true,
      message: `Response ${action}ed successfully`,
      status: teamBid.status
    });

  } catch (error) {
    console.error('Error processing team bid response:', error);
    res.status(500).json({ 
      error: error.message || 'Error processing team bid response'
    });
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
    res.status(500).json({ 
      teamBids: [],
      error: "Error fetching team bids" 
    });
  }
};