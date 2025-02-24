import { useEffect, useCallback } from 'react';
import io from 'socket.io-client';

// Initialize socket connection
const socket = io('http://localhost:5000', {
  withCredentials: true,
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

const useSocket = (userId) => {
  // Join user's room on mount
  useEffect(() => {
    if (userId) {
      socket.emit('joinRoom', userId);
      console.log('Joined room:', userId);
      
      return () => {
        socket.emit('leaveRoom', userId);
        console.log('Left room:', userId);
      };
    }
  }, [userId]);

  // Bid-related events
  const setupBidListener = useCallback((callback) => {
    socket.on('bidPlaced', callback);
    return () => socket.off('bidPlaced', callback);
  }, []);

  const setupTeamBidListener = useCallback((callback) => {
    socket.on('teamBidPlaced', callback);
    return () => socket.off('teamBidPlaced', callback);
  }, []);

  const setupOutbidListener = useCallback((callback) => {
    socket.on('outbid', callback);
    return () => socket.off('outbid', callback);
  }, []);

  const setupBidRefundListener = useCallback((callback) => {
    socket.on('bidRefunded', callback);
    return () => socket.off('bidRefunded', callback);
  }, []);

  // Team-related events
  const setupTeamInviteListener = useCallback((callback) => {
    socket.on('newInvite', callback);
    return () => socket.off('newInvite', callback);
  }, []);

  const setupInviteResponseListener = useCallback((callback) => {
    socket.on('inviteResponse', callback);
    return () => socket.off('inviteResponse', callback);
  }, []);

  const setupTeamUpdateListener = useCallback((callback) => {
    socket.on('teamUpdate', callback);
    return () => socket.off('teamUpdate', callback);
  }, []);

  // Notification events
  const setupNotificationListener = useCallback((callback) => {
    socket.on('notification', callback);
    return () => socket.off('notification', callback);
  }, []);

  // Connection status events
  const setupConnectionListeners = useCallback((onConnect, onDisconnect) => {
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Emit events
  const emitBid = useCallback((permitId, amount) => {
    socket.emit('placeBid', { permitId, amount });
  }, []);

  const emitTeamBid = useCallback((permitId, teamId, amount) => {
    socket.emit('placeTeamBid', { permitId, teamId, amount });
  }, []);

  const emitInvite = useCallback((username, teamId) => {
    socket.emit('sendInvite', { username, teamId });
  }, []);

  const emitInviteResponse = useCallback((inviteId, accept) => {
    socket.emit('respondToInvite', { inviteId, accept });
  }, []);

  return {
    // Listeners
    setupBidListener,
    setupTeamBidListener,
    setupOutbidListener,
    setupBidRefundListener,
    setupTeamInviteListener,
    setupInviteResponseListener,
    setupTeamUpdateListener,
    setupNotificationListener,
    setupConnectionListeners,
    // Emitters
    emitBid,
    emitTeamBid,
    emitInvite,
    emitInviteResponse,
    // Socket instance (in case direct access is needed)
    socket
  };
};

export default useSocket;