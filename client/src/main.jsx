import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import 'react-toastify/dist/ReactToastify.css';
import './index.css'
import "./responsive.css";
import axios from 'axios';

// Determine API base URL:
// - By default use the cloud URL from VITE_API_BASE
// - During local development (localhost/127.0.0.1) use http://localhost:3000
// - Override during development by setting VITE_FORCE_API_BASE=true to force using VITE_API_BASE
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const forceApi = import.meta.env.VITE_FORCE_API_BASE === 'true';
const cloudDefault = import.meta.env.VITE_API_BASE || 'https://mern-login-and-register-with-json-web-78u3.onrender.com';
const apiBase = (!isLocalhost || forceApi) ? cloudDefault : 'http://localhost:3000';
axios.defaults.baseURL = apiBase;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
