import { useState, useCallback } from 'react';
import apiService from '../services/api';

export const useBidding = (user, setUser, showAlert) => {
  const [bidAmounts, setBidAmounts] = useState({});

  const placeBid = useCallback(async (permitId) => {
    try {
      const bidValue = Number(bidAmounts[permitId]);
      // ... bidding logic ...
    } catch (error) {
      console.error('Bidding error:', error);
      showAlert(error.response?.data?.error || 'Error placing bid', 'error');
    }
  }, [bidAmounts, user, setUser, showAlert]);

  return {
    bidAmounts,
    setBidAmounts,
    placeBid
  };
};