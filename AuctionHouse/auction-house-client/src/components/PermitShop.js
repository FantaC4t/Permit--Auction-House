// filepath: /auction-house-client/src/components/PermitShop.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './PermitShop.css';

// Move socket initialization outside component to prevent recreation
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
  const [storedNotifications, setStoredNotifications] = useState([]);
  const [showStoredNotificationsModal, setShowStoredNotificationsModal] = useState(false);

  const animateCoins = (isIncrease = false) => {
    const coinsElement = document.getElementById('user-coins');
    if (coinsElement) {
      coinsElement.classList.remove('coins-update');
      coinsElement.removeAttribute('data-coins-increased');
      coinsElement.removeAttribute('data-coins-decreased');
      
      // Force a reflow
      void coinsElement.offsetWidth;
      
      coinsElement.classList.add('coins-update');
      coinsElement.setAttribute(
        isIncrease ? 'data-coins-increased' : 'data-coins-decreased',
        'true'
      );
      
      setTimeout(() => {
        if (coinsElement) {
          coinsElement.classList.remove('coins-update');
          coinsElement.removeAttribute('data-coins-increased');
          coinsElement.removeAttribute('data-coins-decreased');
        }
      }, 500);
    }
  };

  // Separate data fetching effect from socket listener
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [permitsRes, userRes, invitesRes, notificationsRes] = await Promise.all([
          axios.get('http://localhost:5000/permits', { withCredentials: true }),
          axios.get('http://localhost:5000/user', { withCredentials: true }),
          axios.get('http://localhost:5000/invites', { withCredentials: true }),
          axios.get('http://localhost:5000/outbid-notifications', { withCredentials: true })
        ]);

        if (isMounted) {
          setPermits(permitsRes.data);
          setUser(prevUser => ({
            ...prevUser,
            ...userRes.data
          }));
          setInvites(invitesRes.data);
          setOutbidNotifications(notificationsRes.data);

          // Check for stored notifications
          const storedNotifications = JSON.parse(localStorage.getItem('outbidNotifications') || '[]');
          if (storedNotifications.length > 0) {
            // Show modal with stored notifications
            setStoredNotifications(storedNotifications);
            setShowStoredNotificationsModal(true);
            // Clear stored notifications
            localStorage.removeItem('outbidNotifications');
          }

          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array for initial fetch

  // Separate useEffect for socket events
  useEffect(() => {
    const handleBidPlaced = async (data) => {
      const currentPermit = permits.find(p => p._id === data.permitId);
      
      // Check if you were the highest bidder before this new bid
      const wasHighestBidder = currentPermit && 
        user.bids && 
        user.bids[data.permitId] === currentPermit.highest_bid && 
        data.bidder !== user._id;

      // Update permits with new bid
      setPermits(prevPermits => 
        prevPermits.map(p => 
          p._id === data.permitId ? { ...p, highest_bid: data.bidAmount } : p
        )
      );

      // If you placed the bid
      if (data.bidder === user._id) {
        try {
          const userRes = await axios.get('http://localhost:5000/user', { withCredentials: true });
          setUser(prevUser => {
            const updatedUser = {
              ...userRes.data,
              bids: {
                ...prevUser.bids,
                [data.permitId]: data.bidAmount
              }
            };
            requestAnimationFrame(() => animateCoins(false));
            return updatedUser;
          });
          showAlert("Bid placed successfully!", "success");
        } catch (error) {
          console.error('Error fetching updated user data:', error);
        }
      }
      // If you were outbid
      else if (wasHighestBidder) {
        try {
          const userRes = await axios.get('http://localhost:5000/user', { withCredentials: true });
          
          setOutbidNotifications(prev => [...prev, {
            permitName: currentPermit.name,
            bidAmount: data.bidAmount,
            timestamp: new Date()
          }]);
          
          showAlert(`You were outbid on ${currentPermit.name}!`, "warning");

          setUser(prevUser => {
            const updatedUser = {
              ...userRes.data,
              bids: {
                ...prevUser.bids,
                [data.permitId]: currentPermit.highest_bid
              }
            };
            requestAnimationFrame(() => animateCoins(true));
            return updatedUser;
          });

          // Store notification for offline access
          const notification = {
            permitName: currentPermit.name,
            bidAmount: data.bidAmount,
            timestamp: new Date()
          };

          const storedNotifications = JSON.parse(localStorage.getItem('outbidNotifications') || '[]');
          localStorage.setItem('outbidNotifications', JSON.stringify([...storedNotifications, notification]));

        } catch (error) {
          console.error('Error fetching updated user data:', error);
        }
      }
    };

    socket.on('bidPlaced', handleBidPlaced);
    return () => socket.off('bidPlaced', handleBidPlaced);
  }, [user._id, permits, user.bids]);

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  };

  const placeBid = async (permitId) => {
    const amount = parseInt(bidAmount[permitId]);
    const currentPermit = permits.find(p => p._id === permitId);

    // Validate bid amount
    if (!amount || isNaN(amount) || amount <= 0) {
      showAlert("Please enter a valid bid amount!", "error");
      return;
    }

    // Get fresh user data before validating coins
    try {
      const userRes = await axios.get('http://localhost:5000/user', { withCredentials: true });
      const freshUserData = userRes.data;

      // Validate with fresh coin data
      if (amount > freshUserData.coins) {
        showAlert("You don't have enough coins for this bid!", "error");
        setUser(prev => ({
          ...prev,
          coins: freshUserData.coins
        }));
        return;
      }

      // Validate bid is higher than current highest
      if (currentPermit.highest_bid && amount <= currentPermit.highest_bid) {
        showAlert("Your bid must be higher than the current highest bid!", "error");
        return;
      }

      await axios.post(
        `http://localhost:5000/bid/${permitId}`,
        { bid_amount: amount },
        { withCredentials: true }
      );

      // Clear bid input after successful bid
      setBidAmount(prev => ({ ...prev, [permitId]: '' }));

    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred while placing the bid.";
      showAlert(errorMessage, "error");
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
              <div className="notification-content">
                <span>You were outbid on <strong>{notification.permitName}</strong> with a bid of <strong>{notification.bidAmount}</strong> coins</span>
                <span className="notification-time">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </span>
              </div>
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
                <strong>{invite.inviter.username}</strong> invited you to bid on <strong>{invite.permit.name}</strong>
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

      {showStoredNotificationsModal && (
        <>
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                Outbid Notifications While You Were Away
                <span 
                  className="modal-close" 
                  onClick={() => setShowStoredNotificationsModal(false)}
                >×</span>
              </div>
              <div className="stored-notifications-content">
                {storedNotifications.map((notification, index) => (
                  <div key={index} className="notification">
                    <div className="notification-content">
                      <span>
                        You were outbid on <strong>{notification.permitName}</strong> 
                        with a bid of <strong>{notification.bidAmount}</strong> coins
                      </span>
                      <span className="notification-time">
                        {new Date(notification.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div 
            className="overlay" 
            onClick={() => setShowStoredNotificationsModal(false)} 
          />
        </>
      )}
    </div>
  );
};

export default PermitShop;