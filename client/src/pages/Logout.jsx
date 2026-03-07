import React, { useEffect } from 'react';
import "../styles/Logout.css";
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("auth");
    navigate("/login");
  }, [navigate]);

  return (
    <div className='logout-main'>
      <h1>Logout Successful!</h1>
      <p>Redirecting to login...</p>
    </div>
  );
};

export default Logout;