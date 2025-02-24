import React, { useState, useContext } from 'react';
import './App.css';
import Login from './components/Login';
import PermitShop from './components/PermitShop';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, UserContext } from './context/UserContext';

const ProtectedRoute = ({ children }) => {
  const { user } = useContext(UserContext);
  if (!user) {
    return <Navigate to="/login" />;
  }
  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <UserProvider>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PermitShop />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </UserProvider>
    </BrowserRouter>
  );
};

export default App;
