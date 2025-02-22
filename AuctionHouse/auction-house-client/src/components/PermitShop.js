// filepath: /auction-house-client/src/components/PermitShop.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

const PermitShop = () => {
  const [permits, setPermits] = useState([]);
  const [user, setUser] = useState({});
  const [invites, setInvites] = useState([]);
  const [outbidNotifications, setOutbidNotifications] = useState([]);

  useEffect(() => {
    // Fetch permits, user, invites, and outbid notifications
    const fetchData = async () => {
      const permitsResponse = await axios.get('/api/permits');
      const userResponse = await axios.get('/api/user');
      const invitesResponse = await axios.get('/api/invites');
      const outbidNotificationsResponse = await axios.get('/api/outbid-notifications');

      setPermits(permitsResponse.data);
      setUser(userResponse.data);
      setInvites(invitesResponse.data);
      setOutbidNotifications(outbidNotificationsResponse.data);
    };

    fetchData();

    // Listen for bidPlaced event
    socket.on('bidPlaced', (data) => {
      setPermits((prevPermits) =>
        prevPermits.map((permit) =>
          permit._id === data.permitId ? { ...permit, highest_bid: data.bidAmount } : permit
        )
      );
      if (data.user._id === user._id) {
        setUser((prevUser) => ({ ...prevUser, coins: data.user.coins }));
      }
    });

    return () => {
      socket.off('bidPlaced');
    };
  }, [user._id]);

  const placeBid = async (permitId, bidAmount) => {
    try {
      const response = await axios.post(`/api/bid/${permitId}`, { bid_amount: bidAmount });
      setUser(response.data.user);
      setPermits(response.data.permits);
    } catch (error) {
      console.error('Error placing bid:', error);
    }
  };

  const respondInvite = async (inviteId, action) => {
    try {
      await axios.post(`/api/${action}_invite/${inviteId}`);
      setInvites(invites.filter(invite => invite._id !== inviteId));
    } catch (error) {
      console.error('Error responding to invite:', error);
    }
  };

  return (
    <div>
      <h1>Welcome to the Permit Shop, {user.username || user.userId}!</h1>
      <h2>Your Coins: {user.coins}</h2>

      <div className="invites">
        <h2>Team Invites</h2>
        {invites.length > 0 ? (
          invites.map(invite => (
            <div key={invite._id} className="invite">
              <div className="invite-message">
                <strong>{invite.inviter}</strong> invited you to bid on <strong>{invite.permit}</strong>.
                You need <strong>{invite.bid_amount}</strong> coins to join.
              </div>
              <div className="invite-buttons">
                <button onClick={() => respondInvite(invite._id, 'accept')}>Accept</button>
                <button onClick={() => respondInvite(invite._id, 'reject')}>Reject</button>
              </div>
            </div>
          ))
        ) : (
          <p>No invites yet.</p>
        )}
      </div>

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
              <td>{permit.name}</td>
              <td>{permit.description}</td>
              <td>{permit.highest_bid || 'No bids yet'}</td>
              <td>{user.bids[permit._id] || 'No bid placed'}</td>
              <td>
                <input type="number" placeholder="Enter bid" min="0" onChange={(e) => setBidAmount(e.target.value)} />
                <button onClick={() => placeBid(permit._id, bidAmount)}>Bid</button>
                <input type="text" placeholder="Username" onChange={(e) => setInviteUser(e.target.value)} />
                <button onClick={() => sendInvite(permit._id)}>Invite</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {outbidNotifications.length > 0 && (
        <div className="notifications">
          {outbidNotifications.map((notification, index) => (
            <div key={index} className="notification">
              You were outbid on {notification.permitName} with a bid of {notification.bidAmount} coins.
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PermitShop;