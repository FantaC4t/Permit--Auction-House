import React from 'react';

const Navigation = ({ username, coins }) => (
  <nav>
    <div className="nav-brand">Permit Auction</div>
    <div className="user-info">
      <span id="user-coins">{coins}</span>
      <span>{username}</span>
    </div>
  </nav>
);

export default Navigation;