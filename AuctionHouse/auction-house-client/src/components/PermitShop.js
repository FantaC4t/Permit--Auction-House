// filepath: /auction-house-client/src/components/PermitShop.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './PermitShop.css';

// Add axios base URL configuration at the top of the file, after the imports
axios.defaults.baseURL = 'http://localhost:5000';

// Move socket initialization outside component to prevent recreation
const socket = io('http://localhost:5000', {
  withCredentials: true,
  transports: ['websocket', 'polling']
});

const BidHistoryModal = ({ bids, onClose }) => {
  return (
    <div className="modal">
      <div className="modal-content bid-history-modal">
        <div className="modal-header">
          <h2>Bid History</h2>
          <span className="modal-close" onClick={onClose}>×</span>
        </div>
        <div className="bid-list">
          {bids.map(bid => (
            <div key={bid._id} className={`bid-item ${bid.isTeamBid ? 'team-bid' : ''}`}>
              <div className="bid-header">
                <span className="bidder">{bid.bidder.username}</span>
                <span className="amount">{bid.amount} coins</span>
                <span className="time">{new Date(bid.bidTime).toLocaleString()}</span>
              </div>
              {bid.isTeamBid && bid.members && (
                <div className="team-members">
                  <small>Team members:</small>
                  <ul>
                    {bid.members.map((member, index) => (
                      <li key={index}>
                        {member.username} - {member.contribution} coins
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PermitShop = ({ user: initialUser }) => {
  const [permits, setPermits] = useState([]);
  const [user, setUser] = useState(initialUser || {});
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currentPermitForInvite, setCurrentPermitForInvite] = useState(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitedUsers, setInvitedUsers] = useState([]);
  const [inviteBidAmount, setInviteBidAmount] = useState('');
  const [showTeamBidModal, setShowTeamBidModal] = useState(false);
  const [teamBids, setTeamBids] = useState([]);
  const [bidAmounts, setBidAmounts] = useState({});

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

  // Add this useEffect at the top of your other useEffects
  useEffect(() => {
    // Join user's room for real-time notifications
    if (user._id) {
      socket.emit('joinRoom', user._id);
    }

    return () => {
      if (user._id) {
        socket.emit('leaveRoom', user._id);
      }
    };
  }, [user._id]);

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

  useEffect(() => {
    socket.on('teamBidComplete', ({ permitId, teamId, totalAmount }) => {
      setPermits(prev => prev.map(p => 
        p._id === permitId 
          ? { ...p, highest_bid: Math.max(p.highest_bid, totalAmount) }
          : p
      ));

      showAlert(`Team bid of ${totalAmount} coins placed successfully!`, 'success');
    });

    return () => {
      socket.off('teamBidComplete');
    };
  }, []);

  // Add this useEffect after your other socket effects
  useEffect(() => {
    socket.on('inviteResponse', ({ inviteId, action, teamId }) => {
      // Update invites list if needed
      setInvites(prev => prev.filter(inv => inv._id !== inviteId));
      
      if (action === 'accept') {
        showAlert('Someone accepted your team invite!', 'success');
      }
    });

    return () => {
      socket.off('inviteResponse');
    };
  }, []);

  // Add this useEffect with your other socket effects
  useEffect(() => {
    socket.on('newInvite', (invite) => {
      setInvites(prev => [...prev, invite]);
      showAlert(`New team invite received from ${invite.inviter.username}!`, 'info');
    });

    return () => {
      socket.off('newInvite');
    };
  }, []);

  // Add this useEffect with your other socket effects
  useEffect(() => {
    socket.on('teamBidRefunded', ({ permitId, refundAmount, newBidAmount }) => {
      // Update user's coins
      setUser(prev => ({
        ...prev,
        coins: prev.coins + refundAmount
      }));

      // Show refund notification
      showAlert(
        `Your team bid was outbid! You've been refunded ${refundAmount} coins.`, 
        'info'
      );

      // Animate the coins increase
      requestAnimationFrame(() => animateCoins(true));
    });

    return () => {
      socket.off('teamBidRefunded');
    };
  }, []);

  const showAlert = (message, type) => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  };

  const placeBid = async (permitId) => {
    try {
      const bidValue = Number(bidAmounts[permitId]);

      if (!bidValue || isNaN(bidValue)) {
        showAlert('Please enter a valid bid amount', 'error');
        return;
      }

      // Add validation for user coins
      if (bidValue > user.coins) {
        showAlert('Insufficient coins', 'error');
        return;
      }

      const response = await axios.post(
        `/permits/${permitId}/bid`,
        { bid_amount: bidValue },
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setUser(prev => ({
          ...prev,
          coins: response.data.updatedCoins,
          bids: {
            ...prev.bids,
            [permitId]: bidValue
          }
        }));

        setBidAmounts(prev => ({
          ...prev,
          [permitId]: ''
        }));

        // Update permits list with new highest bid
        setPermits(prev => prev.map(p => 
          p._id === permitId 
            ? { ...p, highest_bid: response.data.highestBid }
            : p
        ));

        showAlert('Bid placed successfully!', 'success');
        animateCoins(false);
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      const errorMessage = error.response?.data?.error || 'Error placing bid';
      showAlert(errorMessage, 'error');
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

  const respondToInvite = async (invite, action) => {
    try {
      const response = await axios.post(
        `http://localhost:5000/teams/invite/${invite._id}/respond`, // Updated path
        { action },
        { withCredentials: true }
      );

      if (response.data.success) {
        // Remove the invite from state
        setInvites(prev => prev.filter(inv => inv._id !== invite._id));
        showAlert(response.data.message, 'success');

        if (action === 'accept') {
          // Refresh data
          const [userRes, permitsRes] = await Promise.all([
            axios.get('http://localhost:5000/user', { withCredentials: true }),
            axios.get('http://localhost:5000/permits', { withCredentials: true })
          ]);

          setUser(prev => ({
            ...prev,
            ...userRes.data
          }));
          setPermits(permitsRes.data);
        }
      }
    } catch (error) {
      console.error('Error responding to invite:', error);
      const errorMessage = error.response?.data?.error || 'An error occurred';
      showAlert(errorMessage, 'error');
    }
  };

  const showBidHistory = async (permitId) => {
    try {
      const [bidRes, teamBidRes] = await Promise.all([
        axios.get(`http://localhost:5000/permit/${permitId}/bids`, { withCredentials: true }),
        axios.get(`http://localhost:5000/team-bids/${permitId}`, { withCredentials: true })
      ]);

      // Ensure we have arrays even if the response is empty
      const bids = bidRes.data?.bids || [];
      const teamBids = teamBidRes.data?.teamBids || [];

      setBidHistory(bids);
      setTeamBids(teamBids);
      setShowBidHistoryModal(true);
    } catch (error) {
      console.error('Error fetching bid history:', error);
      showAlert("Error fetching bid history", "error");
    }
  };

  const checkUserExists = async (username) => {
    try {
      const response = await axios.get(`http://localhost:5000/check-user/${username}`, 
        { withCredentials: true }
      );
      return response.data.exists;
    } catch (error) {
      console.error('Error checking user:', error);
      return false;
    }
  };

  const sendInvites = async () => {
    try {
      if (!currentPermitForInvite || !invitedUsers.length || !inviteBidAmount) {
        showAlert('Please fill in all required fields', 'error');
        return;
      }

      const response = await axios.post(
        `http://localhost:5000/invite/${currentPermitForInvite._id}`,
        {
          invitedUsers,
          bidAmount: Number(inviteBidAmount)
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        showAlert('Invites sent successfully!', 'success');
        setInvitedUsers([]);
        setInviteBidAmount('');
        setShowInviteModal(false);
      }
    } catch (error) {
      console.error('Error sending invites:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send invites';
      showAlert(errorMessage, 'error');
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
                <div className="invite-details">
                  <span className="contribution">Your contribution: {invite.bidAmount} coins</span>
                  <span className="total-bid">
                    Total team bid: {invite.totalTeamBid} coins
                    <small className="team-size">({invite.teamSize} team members × {invite.bidAmount} coins each)</small>
                  </span>
                </div>
              </div>
              <div className="invite-buttons">
                <button onClick={() => respondToInvite(invite, 'accept')}>Accept</button>
                <button onClick={() => respondToInvite(invite, 'reject')}>Reject</button>
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
                      value={bidAmounts[permit._id] || ''}
                      onChange={(e) => setBidAmounts(prev => ({
                        ...prev,
                        [permit._id]: e.target.value
                      }))}
                      placeholder="Enter bid"
                      min="0"
                    />
                    <button onClick={() => placeBid(permit._id)}>Bid</button>
                  </div>
                  <div className="invite-section">
                    <button 
                      onClick={() => {
                        setCurrentPermitForInvite(permit);
                        setInviteUsername('');
                        setInvitedUsers([]);
                        setInviteBidAmount(''); // Reset bid amount
                        setShowInviteModal(true);
                      }}
                    >
                      Invite Users to Bid
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBidHistoryModal && (
        <BidHistoryModal 
          bids={bidHistory} 
          onClose={() => setShowBidHistoryModal(false)} 
        />
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
                        You were outbid on <strong>{notification.permitName} </strong> 
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

      {showInviteModal && (
        <>
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                Invite Users to Bid on {currentPermitForInvite?.name}
                <span 
                  className="modal-close" 
                  onClick={() => setShowInviteModal(false)}
                >×</span>
              </div>
              <div className="invite-modal-content">
                <div className="bid-amount-section">
                  <label>Bid Amount per Person:</label>
                  <input
                    type="number"
                    value={inviteBidAmount}
                    onChange={(e) => setInviteBidAmount(e.target.value)}
                    placeholder="Enter bid amount"
                    min="0"
                  />
                  <div className="bid-summary">
                    <p>Number of invited users: {invitedUsers.length}</p>
                    <p>Total bid if all accept: {
                      inviteBidAmount && invitedUsers.length 
                        ? (Number(inviteBidAmount) * (invitedUsers.length + 1)).toLocaleString()
                        : '0'
                    } coins</p>
                    <p className="bid-note">* Includes your contribution of {inviteBidAmount || '0'} coins</p>
                  </div>
                </div>

                <div className="invite-input-section">
                  <input
                    type="text"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Enter username"
                  />
                  <button 
                    onClick={async () => {
                      if (!inviteUsername.trim()) {
                        showAlert('Please enter a username', 'error');
                        return;
                      }
                      
                      if (invitedUsers.includes(inviteUsername)) {
                        showAlert('User already added to invite list', 'warning');
                        setInviteUsername('');
                        return;
                      }
                  
                      const userExists = await checkUserExists(inviteUsername);
                      if (userExists) {
                        setInvitedUsers([...invitedUsers, inviteUsername]);
                        setInviteUsername('');
                        showAlert('User added to invite list', 'success');
                      } else {
                        showAlert('User not found', 'error');
                      }
                    }}
                  >
                    Add User
                  </button>
                </div>
                
                <div className="invited-users-list">
                  {invitedUsers.map((username, index) => (
                    <div key={index} className="invited-user">
                      {username}
                      <button 
                        onClick={() => setInvitedUsers(invitedUsers.filter(u => u !== username))}
                        className="remove-user"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="invite-actions">
                  <button 
                    onClick={sendInvites}
                    disabled={!invitedUsers.length || !inviteBidAmount}
                  >
                    Send Invites
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="overlay" onClick={() => setShowInviteModal(false)} />
        </>
      )}
    </div>
  );
};

export default PermitShop;