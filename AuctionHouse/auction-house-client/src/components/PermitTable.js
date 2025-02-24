import React from 'react';

const PermitTable = ({ 
  permits, 
  userBids, 
  onShowHistory, 
  onPlaceBid, 
  onInvite,
  bidAmounts,
  onBidAmountChange 
}) => (
  <div className="permits-table">
    <table>
      <thead>
        <tr>
          <th>Permit Name</th>
          <th>Description</th>
          <th>Highest Bid</th>
          <th>Your Bid</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {permits.map(permit => (
          <tr key={permit._id}>
            {/* ... table cell content ... */}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default React.memo(PermitTable);