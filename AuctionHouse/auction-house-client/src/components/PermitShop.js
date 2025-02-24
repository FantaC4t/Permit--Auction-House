import React, { useState, useEffect, useCallback } from 'react';
import Navigation from './shared/Navigation';
import { usePermitContext } from '../context/PermitContext';
import useSocket from '../hooks/useSocket';
import { useDebounce } from '../hooks/useDebounce';
import ErrorBoundary from './shared/ErrorBoundary';
import BidHistoryModal from './modals/BidHistoryModal';
import apiService from '../services/api';
import './PermitShop.css';
import PermitTable from './PermitTable'; // Adjust path as needed

const PermitShop = ({ user: initialUser }) => {
  const { state: permitState, dispatch } = usePermitContext();
  const [user, setUser] = useState(initialUser || {});
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [bidHistory, setBidHistory] = useState([]);
  const [showBidHistoryModal, setShowBidHistoryModal] = useState(false);
  const [bidAmounts, setBidAmounts] = useState({});

  const socket = useSocket(user?._id);
  const debouncedBidAmount = useDebounce(bidAmounts, 300);

  // Animation system
  const animateCoins = useCallback((isIncrease) => {
    const coinsElement = document.getElementById('user-coins');
    if (!coinsElement) return;

    // Remove existing animation classes
    coinsElement.classList.remove('animate-increase', 'animate-decrease');

    // Add new animation class
    coinsElement.classList.add(isIncrease ? 'animate-increase' : 'animate-decrease');

    // Remove animation class after animation completes
    setTimeout(() => {
      coinsElement.classList.remove('animate-increase', 'animate-decrease');
    }, 1000);
  }, []);

  const showAlert = useCallback((message, type = 'info') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: '' }), 5000);
  }, []);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [permitsRes, userRes] = await Promise.all([
          apiService.getPermits(),
          apiService.getCurrentUser()
        ]);
        
        dispatch({ type: 'SET_PERMITS', payload: permitsRes.data });
        setUser(userRes.data);
      } catch (error) {
        showAlert('Error loading data', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dispatch]);

  // Socket event handlers
  useEffect(() => {
    const cleanupBid = socket.setupBidListener((data) => {
      dispatch({ type: 'UPDATE_BID', payload: data });
      if (data.bidder === user._id) {
        animateCoins(false);
      }
    });

    return () => cleanupBid();
  }, [socket, dispatch, user._id]);

  const showBidHistory = async (permitId) => {
    try {
      const response = await apiService.getBids(permitId);
      setBidHistory(response.data);
      setShowBidHistoryModal(true);
    } catch (error) {
      showAlert('Error fetching bid history', 'error');
    }
  };

  const handleInvite = async (permitId, username) => {
    try {
      await apiService.sendInvite(permitId, username);
      showAlert('Invite sent successfully', 'success');
    } catch (error) {
      showAlert('Error sending invite', 'error');
    }
  };

  const placeBid = async (permitId) => {
    try {
      // Example logic:
      const amount = Number(bidAmounts[permitId]);
      if (!amount) return showAlert('Invalid bid', 'error');
      const res = await apiService.placeBid(permitId, amount);
      // ...Update UI...
    } catch (error) {
      showAlert('Bid error', 'error');
    }
  };

  return (
    <ErrorBoundary>
      <div className="permit-shop">
        <Navigation username={user.username} coins={user.coins} />
        
        {alert.show && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : (
          <PermitTable
            permits={permitState.permits}
            userBids={user.bids}
            onShowHistory={showBidHistory}
            onPlaceBid={placeBid}
            onInvite={handleInvite}
            bidAmounts={bidAmounts}
            onBidAmountChange={(id, value) => setBidAmounts(prev => ({
              ...prev,
              [id]: value
            }))}
          />
        )}

        {/* Modals */}
        {showBidHistoryModal && (
          <BidHistoryModal
            bids={bidHistory}
            onClose={() => setShowBidHistoryModal(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default PermitShop;