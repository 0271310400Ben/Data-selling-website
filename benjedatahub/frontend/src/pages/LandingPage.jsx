import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Zap, Phone, User as UserIcon } from 'lucide-react';
import { API_BASE } from '../App';

// Paystack Inline Loader Helper
const loadPaystack = () => {
  return new Promise((resolve) => {
    if (window.PaystackPop) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    document.body.appendChild(script);
  });
};

export default function LandingPage({ siteDetails, user, token }) {
  const [network, setNetwork] = useState('mtn');
  const [recipientName, setRecipientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedVolume, setSelectedVolume] = useState('1'); // "1" meaning 1GB
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load Paystack script on mount
  useEffect(() => {
    loadPaystack();
  }, []);

  // Set default package when network changes
  useEffect(() => {
    setSelectedVolume('1');
  }, [network]);

  const pricing = siteDetails.pricing || {
    mtn: { '1': 5.00, '2': 10.00, '5': 24.00, '10': 48.00 },
    telecel: { '1': 4.80, '2': 9.60, '5': 23.00, '10': 46.00 },
    airteltigo: { '1': 4.50, '2': 9.00, '5': 22.00, '10': 44.00 }
  };

  const currentPrices = pricing[network] || {};

  // Form submit handler - Card/MoMo payment via Paystack
  const handlePaystackPayment = async (e) => {
    e.preventDefault();
    if (!phoneNumber || !recipientName) {
      setMessage({ type: 'error', text: 'Please fill out recipient name and number.' });
      return;
    }
    if (phoneNumber.length < 9) {
      setMessage({ type: 'error', text: 'Please enter a valid Ghana phone number.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const selectedPrice = currentPrices[selectedVolume];
    const email = user?.email || 'customer@benjedatahub.com';

    try {
      // 1. Initialize Paystack on backend
      const initRes = await fetch(`${API_BASE}/payment/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          amount: selectedPrice,
          type: 'direct_purchase',
          metadata: {
            phone: phoneNumber,
            network,
            volume: selectedVolume,
            recipientName,
            resellerId: siteDetails.resellerId || null,
            offerSlug: `${network}_data_bundle`
          }
        })
      });

      const initData = await initRes.json();
      if (!initData.success) {
        throw new Error(initData.error || 'Failed to initialize payment');
      }

      // 2. Open Paystack Inline Checkout
      const handler = window.PaystackPop.setup({
        key: siteDetails.paystackPublicKey,
        email: email,
        amount: Math.round(selectedPrice * 100),
        currency: 'GHS',
        ref: initData.reference,
        callback: async (response) => {
          setLoading(true);
          setMessage({ type: 'info', text: 'Verifying payment and delivering data...' });
          
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/paystack/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                reference: response.reference,
                resellerId: siteDetails.resellerId || null
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setMessage({ 
                type: 'success', 
                text: `Successfully sent ${selectedVolume}GB to ${phoneNumber} (${recipientName})! Ref: ${verifyData.transaction.reference}` 
              });
              setPhoneNumber('');
              setRecipientName('');
            } else {
              setMessage({ type: 'error', text: verifyData.error || 'Payment verified, but order execution failed.' });
            }
          } catch (err) {
            setMessage({ type: 'error', text: 'Verification error: ' + err.message });
          } finally {
            setLoading(false);
          }
        },
        onClose: () => {
          setLoading(false);
          setMessage({ type: 'error', text: 'Payment window closed.' });
        }
      });

      handler.openIframe();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setLoading(false);
    }
  };

  // Form submit handler - Wallet Payment
  const handleWalletPayment = async (e) => {
    e.preventDefault();
    if (!phoneNumber || !recipientName) {
      setMessage({ type: 'error', text: 'Please fill out recipient name and number.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/order/wallet-buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          network,
          volume: selectedVolume,
          phone: phoneNumber,
          recipientName,
          resellerStorefrontId: siteDetails.resellerId ? siteDetails.resellerId : null
        })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Successfully sent ${selectedVolume}GB to ${phoneNumber} using your wallet! Ref: ${data.transaction.reference}` 
        });
        setPhoneNumber('');
        setRecipientName('');
        // Reload user wallet state in layout
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Fulfillment error.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '4rem auto', padding: '0 2rem' }}>
      
      {/* Title & Headline */}
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #ffffff, #ffb703)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Instant Mobile Data Delivery
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Purchase high-speed internet data for MTN, Telecel, and AirtelTigo instantly using Mobile Money or Card.
        </p>
        {!siteDetails.isMainPortal && (
          <div style={{ marginTop: '1.5rem' }}>
            <span className="storefront-badge">
              <ShieldCheck size={16} /> Partner Storefront of BenjeDataHub
            </span>
          </div>
        )}
      </div>

      {message.text && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          fontWeight: 600,
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: message.type === 'success' ? '#10b981' : '#ef4444',
          border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid-2">
        
        {/* Left Side Box (Recipient Details & Network) */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
            1. Recipient Details
          </h2>

          <label>Select Network</label>
          <div className="network-grid">
            {/* MTN Ghana Card */}
            <div 
              className={`network-card mtn ${network === 'mtn' ? 'active' : ''}`}
              onClick={() => setNetwork('mtn')}
            >
              {/* Clean vector representational logo */}
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#FFCC00"/>
                <ellipse cx="50" cy="50" rx="30" ry="20" fill="none" stroke="#002D62" strokeWidth="6"/>
                <text x="32" y="57" fill="#002D62" fontFamily="Outfit, sans-serif" fontWeight="900" fontSize="22">MTN</text>
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>MTN GHANA</span>
            </div>

            {/* Telecel Ghana Card */}
            <div 
              className={`network-card telecel ${network === 'telecel' ? 'active' : ''}`}
              onClick={() => setNetwork('telecel')}
            >
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="20" fill="#FF3300"/>
                <circle cx="50" cy="40" r="16" fill="white"/>
                <path d="M50 40 L65 70 L35 70 Z" fill="white"/>
                <text x="22" y="85" fill="white" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="12">TELECEL</text>
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>TELECEL</span>
            </div>

            {/* AirtelTigo Ghana Card */}
            <div 
              className={`network-card airteltigo ${network === 'airteltigo' ? 'active' : ''}`}
              onClick={() => setNetwork('airteltigo')}
            >
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="20" fill="#0055FF"/>
                <circle cx="35" cy="50" r="20" fill="#FF8800" opacity="0.8"/>
                <circle cx="65" cy="50" r="20" fill="white" opacity="0.9"/>
                <text x="18" y="82" fill="white" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="10">AIRTELTIGO</text>
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>AT GHANA</span>
            </div>
          </div>

          <form onSubmit={handlePaystackPayment}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="recipient-name">Recipient Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-muted)' }} size={20} />
                <input 
                  type="text" 
                  id="recipient-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Enter recipient's full name"
                  style={{ paddingLeft: '3rem' }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="phone-number">Recipient Number</label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-muted)' }} size={20} />
                <input 
                  type="tel" 
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 0244123456"
                  style={{ paddingLeft: '3rem' }}
                  required
                />
              </div>
            </div>
          </form>
        </div>

        {/* Right Side Box (Select Package / Pricing) */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
            2. Choose Package
          </h2>

          <label style={{ marginBottom: '1rem' }}>Available Data Plans</label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {Object.keys(currentPrices).map((vol) => {
              const price = currentPrices[vol];
              return (
                <div 
                  key={vol}
                  className={`pricing-item ${selectedVolume === vol ? 'active' : ''}`}
                  onClick={() => setSelectedVolume(vol)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Zap size={20} style={{ color: selectedVolume === vol ? '#ffb703' : 'var(--text-secondary)' }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{vol} GB Data Bundle</span>
                  </div>
                  <div>
                    {/* Different colors for GHC and number as requested */}
                    <span className="price-tag-currency">GHC</span>
                    <span className="price-tag-value">{price.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Charge:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                <span style={{ color: '#ffb703', marginRight: '4px' }}>GHC</span>
                <span style={{ color: '#00f5d4' }}>{(currentPrices[selectedVolume] || 0.00).toFixed(2)}</span>
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Paystack Online Payment */}
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handlePaystackPayment}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Processing Transaction...' : 'Pay with Mobile Money / Card'}
              </button>

              {/* Wallet Payment if user is logged in */}
              {user && (
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={handleWalletPayment}
                  disabled={loading}
                  style={{ width: '100%', borderColor: 'rgba(0, 245, 212, 0.2)' }}
                >
                  Pay with Wallet ({user.walletBalance.toFixed(2)} GHS)
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Why Choose Us Section */}
      <div style={{ marginTop: '8rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '2rem 1.5rem' }}>
          <Zap size={40} style={{ color: '#ffb703', marginBottom: '1rem' }} />
          <h3>Instant Delivery</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Orders are executed automatically by our system. Data drops on the recipient's phone within 30 seconds.
          </p>
        </div>
        
        <div className="glass-card" style={{ padding: '2rem 1.5rem' }}>
          <ShieldCheck size={40} style={{ color: '#00f5d4', marginBottom: '1rem' }} />
          <h3>Secure Payments</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            All payments are securely verified by Paystack, supporting all cards and local Mobile Money carriers.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem 1.5rem' }}>
          <Layers size={40} style={{ color: '#7b2cbf', marginBottom: '1rem' }} />
          <h3>Reseller Agency</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Sign up for free, spawn your own custom-branded portal, set your markup, and let your users fund you.
          </p>
        </div>
      </div>

    </div>
  );
}
