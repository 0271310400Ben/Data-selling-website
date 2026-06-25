import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, LayoutDashboard, Settings, Layers, Menu, X } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

// Helper to determine the current storefront domain / subdomain
export const getSubdomain = () => {
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  
  // 1. Local Testing Override (e.g., localhost:3000?sub=john)
  if (params.has('sub')) {
    return params.get('sub');
  }

  // 2. Subdomain Extraction
  const parts = hostname.split('.');
  if (parts.length > 2) {
    if (parts[0] !== 'www' && parts[0] !== 'benjedatahub') {
      return parts[0];
    }
  }
  return null;
};

// Global API Base URL (Render Server URL - can be configured in env)
export const API_BASE = 'http://localhost:5000/api/v1';

function AppContent() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [siteDetails, setSiteDetails] = useState({ siteName: 'BenjeDataHub', isMainPortal: true });
  const navigate = useNavigate();
  const subdomain = getSubdomain();

  useEffect(() => {
    // Fetch site details based on subdomain
    const fetchSiteDetails = async () => {
      try {
        const sub = subdomain || 'www';
        const res = await fetch(`${API_BASE}/reseller/storefront/details/${sub}`);
        const data = await res.json();
        if (data.success) {
          setSiteDetails({
            siteName: data.siteName,
            isMainPortal: data.isMainPortal,
            contactPhone: data.contactPhone,
            paystackPublicKey: data.paystackPublicKey,
            pricing: data.pricing,
            resellerId: data.resellerId
          });
        }
      } catch (err) {
        console.error('Failed to fetch storefront info', err);
      }
    };
    fetchSiteDetails();
  }, [subdomain]);

  useEffect(() => {
    if (token) {
      // Get logged-in user profile
      fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUser(data.user);
          } else {
            // Token expired/invalid
            handleLogout();
          }
        })
        .catch(() => handleLogout());
    } else {
      setUser(null);
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/');
  };

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="nav-logo">
          <Layers className="text-amber-500" style={{ color: '#ffb703' }} />
          <span>{siteDetails.siteName}</span>
        </Link>

        {/* Mobile menu toggle */}
        <button 
          className="btn-secondary" 
          style={{ display: 'none', padding: '0.5rem', border: 'none' }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>

        <ul className="nav-links">
          <li>
            <Link to="/" className="nav-link">Buy Data</Link>
          </li>
          
          {user ? (
            <>
              <li>
                <Link to="/dashboard" className="nav-link flex-center">
                  <LayoutDashboard size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Dashboard
                </Link>
              </li>
              
              {user.role === 'admin' && (
                <li>
                  <Link to="/admin" className="nav-link" style={{ color: '#ffb703' }}>Admin Panel</Link>
                </li>
              )}

              <li>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                    Wallet: <strong style={{ color: '#00f5d4' }}>{user.walletBalance.toFixed(2)} GHS</strong>
                  </span>
                  <button 
                    onClick={handleLogout} 
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              </li>
            </>
          ) : (
            <li>
              <Link to="/login" className="btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}>
                <UserIcon size={16} /> Login / Signup
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <Routes>
        <Route path="/" element={<LandingPage siteDetails={siteDetails} user={user} token={token} />} />
        <Route path="/login" element={<LoginRegister setToken={setToken} />} />
        <Route path="/dashboard" element={<Dashboard user={user} setUser={setUser} token={token} />} />
        <Route path="/admin" element={<AdminDashboard user={user} token={token} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
