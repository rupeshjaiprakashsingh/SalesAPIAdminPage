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
const cloudDefault = import.meta.env.VITE_API_BASE || 'https://api.scanservices.in';
const apiBase = (!isLocalhost || forceApi) ? cloudDefault : 'http://localhost:3000';
axios.defaults.baseURL = apiBase;

// Add a request interceptor to include the X-Tenant-ID header
axios.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    config.headers['X-Tenant-ID'] = tenantId;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Auto-logout on 401 (expired/invalid JWT) so users don't get stuck
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginPage = window.location.pathname.includes('/login');
      if (!isLoginPage) {
        localStorage.removeItem('auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
