import React from 'react';

export default function BidHistoryModal({ bids, onClose }) {
  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Bid History</h2>
        <button onClick={onClose}>Close</button>
        {bids.map((bid, idx) => (
          <div key={bid._id || idx}>
            <span>{bid.bidder?.username || 'Unknown bidder'}: </span>
            <span>{bid.amount} coins</span>
          </div>
        ))}
      </div>
    </div>
  );
}