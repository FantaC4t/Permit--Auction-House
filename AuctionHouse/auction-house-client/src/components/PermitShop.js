// filepath: /auction-house-client/src/components/PermitShop.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './PermitShop.css';

const socket = io('http://localhost:5000', {
  withCredentials: true,
  transports: ['websocket', 'polling']
});

const PermitShop = ({ user: initialUser }) => {
  const [permits, setPermits] = useState([]);
  const [user, setUser] = useState(initialUser);
  const [invites, setInvites] = useState([]);
  const [outbidNotifications, setOutbidNotifications] = useState([]);
  const [bidAmount, setBidAmount] = useState({});
  const [inviteUser, setInviteUser] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [bidHistory, setBidHistory] = useState([]);
  const [showBidHistoryModal, setShowBidHistoryModal] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    // Fetch permits, user, invites, and outbid notifications
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [permitsRes, userRes, invitesRes, notificationsRes] = await Promise.all([
          axios.get('http://localhost:5000/permits', { withCredentials: true }),
          axios.get('http://localhost:5000/user', { withCredentials: true }),
          axios.get('http://localhost:5000/invites', { withCredentials: true }),
          axios.get('http://localhost:5000/outbid-notifications', { withCredentials: true })
        ]);

        setPermits(permitsRes.data);
        setUser(userRes.data);
        setInvites(invitesRes.data);
        setOutbidNotifications(notificationsRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
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

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  };

  const placeBid = async (permitId) => {
    const amount = bidAmount[permitId];
    if (!amount || isNaN(amount) || amount <= 0) {
      showAlert("Please enter a valid bid amount!", "error");
      return;
    }

    try {
      const response = await axios.post(`http://localhost:5000/bid/${permitId}`,
        { bid_amount: amount },
        { withCredentials: true }
      );

      if (response.data.success) {
        showAlert("Bid placed successfully!", "success");
        setUser(prev => ({ ...prev, coins: response.data.updatedCoins }));
        setPermits(prev => prev.map(p => 
          p._id === permitId 
            ? { ...p, highest_bid: response.data.highestBid }
            : p
        ));
        setBidAmount(prev => ({ ...prev, [permitId]: '' }));
      }
    } catch (error) {
      showAlert(error.response?.data?.error || "An error occurred while placing the bid.", "error");
    }
  };

  const sendInvite = async (permitId) => {
    try {
      await axios.post(`http://localhost:5000/invite/${permitId}`, 
        { invitedUser: inviteUser[permitId] },
        { withCredentials: true }
      );
      setInviteUser(prev => ({ ...prev, [permitId]: '' })); // Clear the invite user input
    } catch (error) {
      console.error('Error sending invite:', error);
    }
  };

  const respondInvite = async (inviteId, action) => {
    try {
      await axios.post(`http://localhost:5000/${action}_invite/${inviteId}`, 
        {},
        { withCredentials: true }
      );
      setInvites(invites.filter(invite => invite._id !== inviteId));
    } catch (error) {
      console.error('Error responding to invite:', error);
    }
  };

  const showBidHistory = async (permitId) => {
    try {
      const response = await axios.get(`http://localhost:5000/permit/${permitId}/bids`, 
        { withCredentials: true }
      );
      setBidHistory(response.data.bids);
      setShowBidHistoryModal(true);
    } catch (error) {
      showAlert("Error fetching bid history", "error");
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container">
      <nav>
        <div><a href="/">Shop</a></div>
        <div><a href="/logout">Logout</a></div>
      </nav>

      {alert.show && (
        <div className={`alert ${alert.type}`}>
          {alert.message}
        </div>
      )}

      <h1>Welcome to the Permit Shop, {user.username}!</h1>
      <h2>Your Coins: <span id="user-coins">{user.coins}</span></h2>

      {outbidNotifications.length > 0 && (
        <div className="notifications">
          {outbidNotifications.map((notification, index) => (
            <div key={index} className="notification">
              You were outbid on {notification.permitName} with a bid of {notification.bidAmount} coins.
            </div>
          ))}
        </div>
      )}

      <div className="invites">
        <h2>Team Invites</h2>
        {invites.length > 0 ? (
          invites.map(invite => (
            <div key={invite._id} className="invite">
              <div className="invite-message">
                <strong>{invite.inviter}</strong> invited you to bid on <strong>{invite.permit}</strong>.
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
                <td>{permit.name}</td>
                <td>{permit.description}</td>
                <td className="highest-bid">
                  <a href="#" onClick={() => showBidHistory(permit._id)}>
                    {permit.highest_bid || "No bids yet"}
                  </a>
                </td>
                <td>{user.bids?.[permit._id] || "No bid placed"}</td>
                <td className="actions">
                  <div className="bid-section">
                    <input
                      type="number"
                      value={bidAmount[permit._id] || ''}
                      onChange={(e) => setBidAmount(prev => ({
                        ...prev,
                        [permit._id]: e.target.value
                      }))}
                      placeholder="Enter bid"
                      min="0"
                    />
                    <button onClick={() => placeBid(permit._id)}>Bid</button>
                  </div>
                  <div className="invite-section">
                    <input
                      type="text"
                      value={inviteUser[permit._id] || ''}
                      onChange={(e) => setInviteUser(prev => ({
                        ...prev,
                        [permit._id]: e.target.value
                      }))}
                      placeholder="Username"
                    />
                    <button onClick={() => sendInvite(permit._id)}>Invite</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBidHistoryModal && (
        <>
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                Bid History
                <span className="modal-close" onClick={() => setShowBidHistoryModal(false)}>×</span>
              </div>
              <div id="bidHistoryContent">
                {bidHistory.map((bid, index) => (
                  <div key={index} className="bid">
                    <p>Bidder: {bid.bidder.username}</p>
                    <p>Amount: {bid.amount}</p>
                    <p>Time: {new Date(bid.bidTime).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="overlay" onClick={() => setShowBidHistoryModal(false)} />
        </>
      )}
    </div>
  );
};

export default PermitShop;