import React, { useState } from 'react';
import './App.css';
import Login from './components/Login';
import PermitShop from './components/PermitShop';

const App = () => {
  const [user, setUser] = useState(null);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  return (
    <div className="App">
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <PermitShop user={user} />
      )}
    </div>
  );
};

export default App;
