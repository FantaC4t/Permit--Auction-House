import React, { createContext, useContext, useReducer } from 'react';

const PermitContext = createContext();

const permitReducer = (state, action) => {
  switch (action.type) {
    case 'SET_PERMITS':
      return { ...state, permits: action.payload };
    case 'UPDATE_BID':
      return {
        ...state,
        permits: state.permits.map(permit =>
          permit._id === action.payload.permitId
            ? { ...permit, currentBid: action.payload.amount }
            : permit
        )
      };
    default:
      return state;
  }
};

export const usePermitContext = () => {
  const context = useContext(PermitContext);
  if (!context) {
    throw new Error('usePermitContext must be used within a PermitProvider');
  }
  return context;
};

export const PermitProvider = ({ children }) => {
  const [state, dispatch] = useReducer(permitReducer, {
    permits: [],
    loading: false,
    error: null
  });

  return (
    <PermitContext.Provider value={{ state, dispatch }}>
      {children}
    </PermitContext.Provider>
  );
};