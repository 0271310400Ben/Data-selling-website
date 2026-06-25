import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Settings, Globe, History, CheckCircle, Clock, XCircle, Plus, AlertCircle, Save } from 'lucide-react';
import { API_BASE } from '../App';

export default function Dashboard({ user, setUser, token }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('wallet');
  const [fundAmount, setFundAmount] = useState('');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  
  // Reseller Storefront States
  const [subdomain, setSubdomain] = useState('');
  const [siteName, setSiteName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [paystackSecretKey, setPaystackSecretKey] = useState('');
  const [markupPercentage, setMarkupPercentage] = useState(10);
  const [storefront, setStorefront] = useState(null);
  
  // Reseller Custom Pricing State
  const [customPricing, setCustomPricing] = useState({
    mtn: { '1': '', '2': '', '5': '', '10': '' },
    telecel: { '1': '', '2': '', '5': '', '10': '' },
    airteltigo: { '1': '', '2': '', '5': '', '10': '' }
  });

  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    // Fetch transactions
    fetch(`${API_BASE}/payment/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTransactions(data.transactions);
        }
      });

    // Fetch storefront configuration
    fetch(`${API_BASE}/reseller/storefront/my`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.storefront) {
          setStorefront(data.storefront);
          setSubdomain(data.storefront.subdomain);
          setSiteName(data.storefront.siteName);
          setContactPhone(data.storefront.contactPhone || '');
          setPaystackPublicKey(data.storefront.paystackPublicKey || '');
          setPaystackSecretKey(data.storefront.paystackSecretKey || '');
          setMarkupPercentage(data.storefront.markupPercentage || 10);
          
          // Populate custom pricing fields if they exist
          if (data.storefront.customPricing) {
            const pricingObj = { ...customPricing };
            Object.keys(data.storefront.customPricing).forEach(net => {
              const netMap = data.storefront.customPricing[net] || {};
              pricingObj[net] = { ...pricingObj[net], ...netMap };
            });
            setCustomPricing(pricingObj);
          }
        }
      });
  }, [token, navigate]);

  // Fund Wallet through Paystack
  const handleFundWallet = async (e) => {
    e.preventDefault();
    if (!fundAmount || Number(fundAmount) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      return;
    }

    setFundingLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Fetch admin keys to use for loading Paystack
      const adminDetailsRes = await fetch(`${API_BASE}/reseller/storefront/details/www`);
      const adminDetails = await adminDetailsRes.json();
      const publicKey = adminDetails.paystackPublicKey;

      if (!publicKey) {
        throw new Error('Admin Paystack configuration not found. Please contact support.');
      }

      // Initialize transaction on backend
      const initRes = await fetch(`${API_BASE}/payment/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          amount: fundAmount,
          type: 'wallet_funding',
          metadata: {
            userId: user._id
          }
        })
      });

      const initData = await initRes.json();
      if (!initData.success) {
        throw new Error(initData.error || 'Failed to initialize payment');
      }

      // Open Paystack Inline Modal
      const handler = window.PaystackPop.setup({
        key: publicKey,
        email: user.email,
        amount: Math.round(Number(fundAmount) * 100),
        currency: 'GHS',
        ref: initData.reference,
        callback: async (response) => {
          setFundingLoading(true);
          setMessage({ type: 'info', text: 'Confirming payment reference...' });
          
          try {
            const verifyRes = await fetch(`${API_BASE}/payment/paystack/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: response.reference })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setMessage({ type: 'success', text: `Wallet successfully funded with GHC ${fundAmount}! Refreshing...` });
              setFundAmount('');
              // Refresh user wallet state
              setTimeout(() => window.location.reload(), 2000);
            } else {
              setMessage({ type: 'error', text: verifyData.error || 'Verification failed.' });
            }
          } catch (err) {
            setMessage({ type: 'error', text: err.message });
          } finally {
            setFundingLoading(false);
          }
        },
        onClose: () => {
          setFundingLoading(false);
          setMessage({ type: 'error', text: 'Transaction canceled.' });
        }
      });

      handler.openIframe();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      setFundingLoading(false);
    }
  };

  // Register Storefront
  const handleSaveStorefront = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/reseller/storefront`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subdomain,
          siteName,
          contactPhone,
          paystackPublicKey,
          paystackSecretKey,
          markupPercentage
        })
      });

      const data = await res.json();
      if (data.success) {
        setStorefront(data.storefront);
        setMessage({ type: 'success', text: 'Storefront configurations saved successfully!' });
        // Upgrade role if user role was user
        if (user.role === 'user') {
          setUser({ ...user, role: 'reseller' });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Save Storefront pricing table overrides
  const handleSavePricing = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Clean up empty fields from pricing inputs
    const pricingPayload = {};
    Object.keys(customPricing).forEach(net => {
      pricingPayload[net] = {};
      Object.keys(customPricing[net]).forEach(vol => {
        const val = customPricing[net][vol];
        if (val !== '' && val !== null) {
          pricingPayload[net][vol] = Number(val);
        }
      });
    });

    try {
      const res = await fetch(`${API_BASE}/reseller/storefront/pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pricing: pricingPayload })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Storefront custom pricing sheets updated!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update pricing sheets.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handlePricingChange = (net, vol, val) => {
    setCustomPricing({
      ...customPricing,
      [net]: {
        ...customPricing[net],
        [vol]: val
      }
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '4rem auto', padding: '0 2rem' }}>
      
      {/* Welcome Banner */}
      <div className="wallet-box">
        <div>
          <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Hello, {user?.name}!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Account Type: <strong style={{ color: '#ffb703', textTransform: 'uppercase' }}>{user?.role}</strong>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Wallet Balance</span>
          <h2 style={{ fontSize: '2.5rem', color: '#00f5d4' }}>
            {user?.walletBalance.toFixed(2)} <span style={{ fontSize: '1.2rem', color: '#ffb703' }}>GHS</span>
          </h2>
          {user?.role === 'reseller' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Accrued Profit: <strong style={{ color: '#00f5d4' }}>GHC {user?.profitWallet.toFixed(2)}</strong>
            </p>
          )}
        </div>
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '2.5rem' }}>
        <button 
          className="nav-link"
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            color: activeTab === 'wallet' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeTab === 'wallet' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveTab('wallet')}
        >
          <Wallet size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Fund Wallet
        </button>

        <button 
          className="nav-link"
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            color: activeTab === 'reseller' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeTab === 'reseller' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveTab('reseller')}
        >
          <Globe size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Reseller Storefront
        </button>

        <button 
          className="nav-link"
          style={{ 
            padding: '1rem 1.5rem', 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            color: activeTab === 'history' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeTab === 'history' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Audit Log
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'wallet' && (
        <div className="glass-card" style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Top-up Wallet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Fund your wallet instantly using Cards or Mobile Money. Wallet funds can be spent directly to purchase data at wholesale/reseller cost prices.
          </p>

          <form onSubmit={handleFundWallet}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="fund-amount">Funding Amount (GHS)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.25rem', top: '1rem', color: '#ffb703', fontWeight: 700 }}>GHC</span>
                <input 
                  type="number" 
                  id="fund-amount" 
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Enter funding value e.g. 50" 
                  style={{ paddingLeft: '3.5rem' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={fundingLoading}>
              {fundingLoading ? 'Connecting Paystack Checkout...' : 'Pay with Mobile Money / Card'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'reseller' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
          {/* Main Info */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Reseller Site Settings</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Create your own data selling portal instantly. Provide a subdomain, choose a site name, and direct users to it to earn margins automatically.
            </p>

            {storefront && (
              <div style={{
                background: 'rgba(0, 245, 212, 0.05)',
                border: '1px dashed var(--accent-cyan)',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '2rem'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Your storefront is live at:</span>
                <p style={{ marginTop: '0.25rem' }}>
                  {/* Local testing url link and production placeholder */}
                  <a 
                    href={`/?sub=${storefront.subdomain}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: 'var(--accent-cyan)', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    {window.location.host}/?sub={storefront.subdomain}
                  </a>
                </p>
              </div>
            )}

            <form onSubmit={handleSaveStorefront}>
              <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <label htmlFor="store-subdomain">Subdomain Name</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      id="store-subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="e.g. john-hub" 
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="store-name">Website Title</label>
                  <input 
                    type="text" 
                    id="store-name"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. John Data Hub" 
                    required
                  />
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <label htmlFor="store-contact">Contact Phone Number</label>
                  <input 
                    type="text" 
                    id="store-contact"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 0244123456" 
                  />
                </div>
                <div>
                  <label htmlFor="store-markup">Default Markup (%)</label>
                  <input 
                    type="number" 
                    id="store-markup"
                    value={markupPercentage}
                    onChange={(e) => setMarkupPercentage(e.target.value)}
                    placeholder="e.g. 10" 
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Applied to default pricing sheets for items without explicit pricing overrides.
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem 0', marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#ffb703' }}>Custom Payment Key Gateway (Paystack)</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                  Optional. If configured, payments made on your storefront will route directly into your own Paystack account. If left blank, payments route to BenjeDataHub, and your earnings are credited as balance.
                </p>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="store-paystack-pub">Paystack Public Key</label>
                  <input 
                    type="text" 
                    id="store-paystack-pub"
                    value={paystackPublicKey}
                    onChange={(e) => setPaystackPublicKey(e.target.value)}
                    placeholder="pk_test_..." 
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label htmlFor="store-paystack-sec">Paystack Secret Key</label>
                  <input 
                    type="password" 
                    id="store-paystack-sec"
                    value={paystackSecretKey}
                    onChange={(e) => setPaystackSecretKey(e.target.value)}
                    placeholder="sk_test_..." 
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', display: 'inline-flex', gap: '0.5rem' }}>
                <Save size={18} /> Save Website Configurations
              </button>
            </form>
          </div>

          {/* Pricing Custom Grid */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Package Pricing Sheets</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Override default pricing markups by typing specific retail prices in GHS for each package. Leave blank to inherit default percentage markup.
            </p>

            <form onSubmit={handleSavePricing}>
              {/* MTN Pricing Override */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#ffcc00', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem', marginBottom: '1rem' }}>
                  MTN Ghana
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>1GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.mtn['1']}
                      onChange={(e) => handlePricingChange('mtn', '1', e.target.value)}
                      placeholder="e.g. 5.50" 
                    />
                  </div>
                  <div>
                    <label>2GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.mtn['2']}
                      onChange={(e) => handlePricingChange('mtn', '2', e.target.value)}
                      placeholder="e.g. 11.00" 
                    />
                  </div>
                </div>
              </div>

              {/* Telecel Pricing Override */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#ff3300', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem', marginBottom: '1rem' }}>
                  Telecel Ghana
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>1GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.telecel['1']}
                      onChange={(e) => handlePricingChange('telecel', '1', e.target.value)}
                      placeholder="e.g. 5.20" 
                    />
                  </div>
                  <div>
                    <label>2GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.telecel['2']}
                      onChange={(e) => handlePricingChange('telecel', '2', e.target.value)}
                      placeholder="e.g. 10.50" 
                    />
                  </div>
                </div>
              </div>

              {/* AirtelTigo Pricing Override */}
              <div style={{ marginBottom: '2.5rem' }}>
                <h3 style={{ color: '#0055ff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem', marginBottom: '1rem' }}>
                  AirtelTigo
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>1GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.airteltigo['1']}
                      onChange={(e) => handlePricingChange('airteltigo', '1', e.target.value)}
                      placeholder="e.g. 5.00" 
                    />
                  </div>
                  <div>
                    <label>2GB (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={customPricing.airteltigo['2']}
                      onChange={(e) => handlePricingChange('airteltigo', '2', e.target.value)}
                      placeholder="e.g. 9.80" 
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(255, 183, 3, 0.4)' }}>
                <Plus size={16} /> Save Price Sheets
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Transaction Audit Log</h2>
          
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Volume / Plan</th>
                  <th>Phone / Recipient</th>
                  <th>Charge</th>
                  {user?.role === 'reseller' && <th>Profit</th>}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'reseller' ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map(tx => (
                    <tr key={tx._id}>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(tx.timestamp).toLocaleString()}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tx.reference}</td>
                      <td>
                        <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{tx.volume || '-'}</td>
                      <td>
                        {tx.recipientPhone ? (
                          <span>
                            {tx.recipientPhone} <small style={{ color: 'var(--text-secondary)' }}>({tx.recipientName})</small>
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ fontWeight: 700, color: tx.amount < 0 ? '#ef4444' : '#00f5d4' }}>
                        {tx.amount < 0 ? '-' : ''}GHC {Math.abs(tx.amount).toFixed(2)}
                      </td>
                      {user?.role === 'reseller' && (
                        <td style={{ color: '#ffb703', fontWeight: 600 }}>
                          {tx.type === 'reseller_sale' ? `+GHC ${tx.profit.toFixed(2)}` : '-'}
                        </td>
                      )}
                      <td>
                        <span className={`badge ${tx.status}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
