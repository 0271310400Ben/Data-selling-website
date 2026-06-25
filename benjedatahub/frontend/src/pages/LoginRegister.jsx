import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus } from 'lucide-react';
import { API_BASE } from '../App';

export default function LoginRegister({ setToken }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? 'login' : 'register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Authentication failed. Please check inputs.');
      }
    } catch (err) {
      setError('Server connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '6rem auto', padding: '0 1.5rem' }}>
      <div className="glass-card">
        
        {/* Toggle Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '2.5rem' }}>
          <button 
            className="nav-link"
            style={{ 
              flex: 1, 
              padding: '1rem', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: isLogin ? '#ffb703' : 'var(--text-secondary)',
              borderBottom: isLogin ? '2px solid #ffb703' : 'none'
            }}
            onClick={() => { setIsLogin(true); setError(''); }}
          >
            Sign In
          </button>
          <button 
            className="nav-link"
            style={{ 
              flex: 1, 
              padding: '1rem', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1.1rem',
              color: !isLogin ? '#ffb703' : 'var(--text-secondary)',
              borderBottom: !isLogin ? '2px solid #ffb703' : 'none'
            }}
            onClick={() => { setIsLogin(false); setError(''); }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{ 
            padding: '0.75rem 1rem', 
            background: 'rgba(239, 68, 68, 0.15)', 
            color: '#ef4444', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* Name Field (Only on Register) */}
          {!isLogin && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="auth-name">Your Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-muted)' }} size={20} />
                <input 
                  type="text" 
                  id="auth-name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name" 
                  style={{ paddingLeft: '3rem' }}
                  required
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="auth-email">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-muted)' }} size={20} />
              <input 
                type="email" 
                id="auth-email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address" 
                style={{ paddingLeft: '3rem' }}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div style={{ marginBottom: '2rem' }}>
            <label htmlFor="auth-password">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-muted)' }} size={20} />
              <input 
                type="password" 
                id="auth-password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password" 
                style={{ paddingLeft: '3rem' }}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', display: 'inline-flex', gap: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : isLogin ? (
              <>
                <LogIn size={18} /> Sign In to Portal
              </>
            ) : (
              <>
                <UserPlus size={18} /> Register Account
              </>
            )}
          </button>
        </form>

        <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account yet? " : "Already have an account? "}
          <span 
            style={{ color: '#ffb703', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
          >
            {isLogin ? 'Create one here' : 'Sign in here'}
          </span>
        </p>

      </div>
    </div>
  );
}
