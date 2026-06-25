import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, DollarSign, Database, Users, TrendingUp, RefreshCw, Edit } from 'lucide-react';
import { API_BASE } from '../App';

export default function AdminDashboard({ user, token }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [portalBalance, setPortalBalance] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('stats');
  
  // Form states for adjusting wallet
  const [targetUser, setTargetUser] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustAction, setAdjustAction] = useState('credit');
  
  // Config state keys
  const [portalApiKey, setPortalApiKey] = useState('');
  const [adminPaystackSecret, setAdminPaystackSecret] = useState('');
  const [adminPaystackPublic, setAdminPaystackPublic] = useState('');

  // Config price sheets
  const [basePricing, setBasePricing] = useState({});
  const [costPricing, setCostPricing] = useState({});

  const [adminMessage, setAdminMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      navigate('/login');
      return;
    }

    // Fetch Stats
    fetch(`${API_BASE}/admin/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data);
        }
      });

    // Fetch Users List
    fetch(`${API_BASE}/admin/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsersList(data.users);
        }
      });

    // Fetch Settings
    fetch(`${API_BASE}/admin/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setSettings(data.settings);
          setPortalApiKey(data.settings.portalApiKey);
          setAdminPaystackSecret(data.settings.adminPaystackSecret || '');
          setAdminPaystackPublic(data.settings.adminPaystackPublic || '');
          setBasePricing(data.settings.basePricing || {});
          setCostPricing(data.settings.costPricing || {});
        }
      });

    // Fetch Portal 02 API Balance
    fetchBalance();
  }, [token, user, navigate]);

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch(`${API_BASE}/order/portal/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPortalBalance(data);
      }
    } catch (err) {
      console.error('Failed to fetch portal API balance', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Adjust user wallet balance handler
  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    setAdminMessage({ type: '', text: '' });

    if (!targetUser || !adjustAmount || Number(adjustAmount) <= 0) {
      setAdminMessage({ type: 'error', text: 'Select a user and input a valid amount.' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/admin/admin/wallet/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: targetUser,
          amount: adjustAmount,
          action: adjustAction
        })
      });

      const data = await res.json();
      if (data.success) {
        setAdminMessage({ type: 'success', text: data.message });
        setAdjustAmount('');
        // Refresh users list
        const updatedUsers = usersList.map(u => 
          u._id === data.user.id ? { ...u, walletBalance: data.user.walletBalance } : u
        );
        setUsersList(updatedUsers);
      } else {
        setAdminMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.message });
    }
  };

  // Save Settings & Keys
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setAdminMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE}/admin/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          portalApiKey,
          adminPaystackSecret,
          adminPaystackPublic,
          basePricing,
          costPricing
        })
      });

      const data = await res.json();
      if (data.success) {
        setAdminMessage({ type: 'success', text: 'Admin configurations and credentials updated successfully!' });
      } else {
        setAdminMessage({ type: 'error', text: data.error || 'Failed to update configurations' });
      }
    } catch (err) {
      setAdminMessage({ type: 'error', text: err.message });
    }
  };

  const handlePriceSheetChange = (sheet, net, vol, val) => {
    if (sheet === 'base') {
      setBasePricing({
        ...basePricing,
        [net]: {
          ...basePricing[net],
          [vol]: val
        }
      });
    } else {
      setCostPricing({
        ...costPricing,
        [net]: {
          ...costPricing[net],
          [vol]: val
        }
      });
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '4rem auto', padding: '0 2rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'linear-gradient(to right, #ffffff, #ffb703)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            <Shield size={36} style={{ color: '#ffb703' }} /> Admin Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>System configurations and financial metrics audits.</p>
        </div>
        <div className="glass-card" style={{ padding: '1rem 1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Portal 02 API Balance</span>
            {portalBalance ? (
              <h3 style={{ color: '#00f5d4', fontSize: '1.4rem' }}>
                {portalBalance.balance.toFixed(2)} GHS
              </h3>
            ) : (
              <h3 style={{ color: 'var(--text-muted)' }}>Loading...</h3>
            )}
          </div>
          <button onClick={fetchBalance} className="btn-secondary" style={{ padding: '0.5rem' }} disabled={loadingBalance}>
            <RefreshCw size={16} className={loadingBalance ? 'spin-anim' : ''} />
          </button>
        </div>
      </div>

      {adminMessage.text && (
        <div style={{
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          marginBottom: '2rem',
          fontWeight: 600,
          background: adminMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: adminMessage.type === 'success' ? '#10b981' : '#ef4444',
          border: `1px solid ${adminMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          {adminMessage.text}
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
            color: activeAdminTab === 'stats' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeAdminTab === 'stats' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveAdminTab('stats')}
        >
          <TrendingUp size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Overview Stats
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
            color: activeAdminTab === 'users' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeAdminTab === 'users' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveAdminTab('users')}
        >
          <Users size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Manage Users
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
            color: activeAdminTab === 'settings' ? '#ffb703' : 'var(--text-secondary)',
            borderBottom: activeAdminTab === 'settings' ? '2px solid #ffb703' : 'none'
          }}
          onClick={() => setActiveAdminTab('settings')}
        >
          <Key size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Credentials & Pricing
        </button>
      </div>

      {/* Tab Panels */}
      {activeAdminTab === 'stats' && stats && (
        <>
          {/* Stats Cards */}
          <div className="grid-3" style={{ marginBottom: '3rem' }}>
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255, 183, 3, 0.1)', padding: '1rem', borderRadius: '16px' }}>
                <Users size={28} style={{ color: '#ffb703' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Registered Users</span>
                <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>{stats.stats.totalUsers}</h2>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(0, 245, 212, 0.1)', padding: '1rem', borderRadius: '16px' }}>
                <TrendingUp size={28} style={{ color: '#00f5d4' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>System Sales Volume</span>
                <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: '#00f5d4' }}>
                  GHC {stats.stats.totalSalesVolume}
                </h2>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(123, 44, 191, 0.1)', padding: '1rem', borderRadius: '16px' }}>
                <DollarSign size={28} style={{ color: '#c77dff' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Accumulated Profits</span>
                <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>GHC {stats.stats.totalProfit}</h2>
              </div>
            </div>
          </div>

          {/* Recent Audits */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Recent Order Logs</h2>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Reference</th>
                    <th>Plan</th>
                    <th>Recipient</th>
                    <th>ISP Cost</th>
                    <th>Charged Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    stats.recentTransactions.map(tx => (
                      <tr key={tx._id}>
                        <td>{new Date(tx.timestamp).toLocaleString()}</td>
                        <td>
                          {tx.userId ? (
                            <span>{tx.userId.name} <br/> <small style={{ color: 'var(--text-muted)' }}>{tx.userId.email}</small></span>
                          ) : 'Walk-in'}
                        </td>
                        <td style={{ fontFamily: 'monospace' }}>{tx.reference}</td>
                        <td>{tx.volume || '-'}</td>
                        <td>{tx.recipientPhone || '-'}</td>
                        <td style={{ color: '#ef4444' }}>GHC {tx.costPrice?.toFixed(2)}</td>
                        <td style={{ color: '#00f5d4', fontWeight: 700 }}>GHC {Math.abs(tx.amount).toFixed(2)}</td>
                        <td>
                          <span className={`badge ${tx.status}`}>{tx.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeAdminTab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
          
          {/* Wallet Adjuster Form */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Adjust User Balances</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Credit or debit user wallets manually. This is useful for offline funding (e.g. manual bank deposits or cash).
            </p>

            <form onSubmit={handleAdjustWallet}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="user-select">Select Target User</label>
                <select 
                  id="user-select"
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  required
                >
                  <option value="">-- Choose User Account --</option>
                  {usersList.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email}) - GHC {u.walletBalance.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2" style={{ marginBottom: '2rem' }}>
                <div>
                  <label htmlFor="adjust-action">Action</label>
                  <select 
                    id="adjust-action"
                    value={adjustAction}
                    onChange={(e) => setAdjustAction(e.target.value)}
                    required
                  >
                    <option value="credit">Credit (Add Funds)</option>
                    <option value="debit">Debit (Deduct Funds)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="adjust-amount">Amount (GHS)</label>
                  <input 
                    type="number" 
                    id="adjust-amount"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 100" 
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Apply Balance Adjustment
              </button>
            </form>
          </div>

          {/* Users List Grid */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Registered Users List</h2>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u._id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: u.role === 'admin' ? '#ff3300' : u.role === 'reseller' ? '#ffb703' : 'var(--text-secondary)'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#00f5d4' }}>GHC {u.walletBalance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeAdminTab === 'settings' && (
        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
            
            {/* Credentials / Keys */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>API & Gateway Credentials</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                Manage API endpoints and credentials. These keys drive connection to Portal 02 and local Paystack checkouts.
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="admin-portal-api">Portal 02 API Key</label>
                <input 
                  type="text" 
                  id="admin-portal-api"
                  value={portalApiKey}
                  onChange={(e) => setPortalApiKey(e.target.value)}
                  placeholder="dk_..." 
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="admin-paystack-pub">Admin Paystack Public Key</label>
                <input 
                  type="text" 
                  id="admin-paystack-pub"
                  value={adminPaystackPublic}
                  onChange={(e) => setAdminPaystackPublic(e.target.value)}
                  placeholder="pk_test_..." 
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label htmlFor="admin-paystack-sec">Admin Paystack Secret Key</label>
                <input 
                  type="password" 
                  id="admin-paystack-sec"
                  value={adminPaystackSecret}
                  onChange={(e) => setAdminPaystackSecret(e.target.value)}
                  placeholder="sk_test_..." 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                Update System Settings
              </button>
            </div>

            {/* Pricing Override Configuration */}
            <div className="glass-card">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Base pricing overrides</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                Set standard selling prices (Retail) and purchase costs (Provider Cost) in GHS.
              </p>

              {/* MTN Ghana */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#ffcc00', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem', marginBottom: '1rem' }}>
                  MTN Ghana Pricing
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label>1GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.mtn?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'mtn', '1', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>1GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.mtn?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'mtn', '1', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>2GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.mtn?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'mtn', '2', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>2GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.mtn?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'mtn', '2', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Telecel Ghana */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: '#ff3300', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem', marginBottom: '1rem' }}>
                  Telecel Ghana Pricing
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label>1GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.telecel?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'telecel', '1', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>1GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.telecel?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'telecel', '1', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>2GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.telecel?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'telecel', '2', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>2GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.telecel?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'telecel', '2', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* AirtelTigo */}
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ color: '#0055ff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem', marginBottom: '1rem' }}>
                  AirtelTigo Ghana Pricing
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label>1GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.airteltigo?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'airteltigo', '1', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>1GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.airteltigo?.['1'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'airteltigo', '1', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <label>2GB Cost (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={costPricing.airteltigo?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('cost', 'airteltigo', '2', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>2GB Retail (GHS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={basePricing.airteltigo?.['2'] || ''}
                      onChange={(e) => handlePriceSheetChange('base', 'airteltigo', '2', e.target.value)}
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>
        </form>
      )}

    </div>
  );
}
