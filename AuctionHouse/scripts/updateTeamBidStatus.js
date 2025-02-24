const mongoose = require('mongoose');
const TeamBid = require('../models/TeamBid');

async function updateTeamBidStatuses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/auction-house', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const result = await TeamBid.updateMany(
      { status: { $nin: ['pending', 'complete', 'failed', 'refunded'] } },
      { $set: { status: 'pending' } }
    );

    console.log(`Updated ${result.modifiedCount} team bids`);
  } catch (error) {
    console.error('Error updating team bids:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateTeamBidStatuses();