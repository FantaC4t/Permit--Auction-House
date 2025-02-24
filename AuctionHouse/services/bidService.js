const TeamBid = require('../models/TeamBid');
const User = require('../models/User');
const Bid = require('../models/Bid');

exports.refundTeamBid = async (permitId, newBidAmount, io) => {
  try {
    // First check for individual bids to refund
    const previousBid = await Bid.findOne({ 
      permit: permitId,
      amount: { $lt: newBidAmount }
    }).populate('bidder');

    if (previousBid) {
      const previousBidder = await User.findById(previousBid.bidder._id);
      previousBidder.coins += previousBid.amount;
      await previousBidder.save();

      io.to(previousBidder._id.toString()).emit('bidRefunded', {
        permitId,
        refundAmount: previousBid.amount,
        updatedCoins: previousBidder.coins
      });

      console.log(`Refunded ${previousBid.amount} coins to individual bidder ${previousBidder.username}`);
    }

    // Then check for team bids to refund
    const currentTeamBid = await TeamBid.findOne({ 
      permitId, 
      status: 'complete',
      totalAmount: { $lt: newBidAmount }
    })
    .populate('members.user')
    .populate('teamLeader');

    if (currentTeamBid) {
      console.log('Found team bid to refund:', currentTeamBid);

      const refundPromises = currentTeamBid.members.map(async (member) => {
        const user = await User.findById(member.user._id);
        const refundAmount = member.contribution;
        user.coins += refundAmount;
        
        io.to(user._id.toString()).emit('teamBidRefunded', {
          permitId,
          refundAmount,
          newBidAmount,
          updatedCoins: user.coins
        });
        
        console.log(`Refunding ${refundAmount} coins to member ${user.username}`);
        return user.save();
      });

      // Handle team leader refund
      const leaderContribution = currentTeamBid.members.find(
        member => member.user._id.toString() === currentTeamBid.teamLeader._id.toString()
      )?.contribution;

      if (leaderContribution) {
        const teamLeader = await User.findById(currentTeamBid.teamLeader._id);
        teamLeader.coins += leaderContribution;
        
        io.to(teamLeader._id.toString()).emit('teamBidRefunded', {
          permitId,
          refundAmount: leaderContribution,
          newBidAmount,
          updatedCoins: teamLeader.coins
        });
        
        console.log(`Refunding ${leaderContribution} coins to leader ${teamLeader.username}`);
        refundPromises.push(teamLeader.save());
      }

      await Promise.all(refundPromises);
      currentTeamBid.status = 'refunded';
      await currentTeamBid.save();
    }
  } catch (error) {
    console.error('Error processing bid refund:', error);
    throw error;
  }
};