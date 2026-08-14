'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) { setError('Please enter the admin passcode'); triggerShake(); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPasscode: passcode }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setError(data.error || 'Incorrect admin passcode');
        triggerShake();
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0f1e 0%, #0f1a2e 50%, #0a0f1e 100%)' }}>
      {/* Animated background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #3b5bdb 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #e03131 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5" style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
      </div>

      <div
        className={`relative z-10 w-full max-w-sm anim-fade-up ${shake ? 'anim-shake' : ''}`}
        style={{ filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.5))' }}
      >
        {/* Admin badge */}
        <div className="flex justify-center mb-6">
          <span
            className="px-4 py-1.5 text-xs font-bold tracking-widest uppercase rounded-full"
            style={{ background: 'rgba(224,49,49,0.15)', color: '#fa5252', border: '1px solid rgba(224,49,49,0.3)' }}
          >
            Restricted Access
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl mb-4"
              style={{ background: 'linear-gradient(135deg, #364fc7 0%, #1c7ed6 100%)' }}
            >
              <span className="material-symbols-outlined icon-fill text-white" style={{ fontSize: '32px' }}>
                shield_person
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Admin Panel</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>StockKeep Administration</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Admin Passcode
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2" style={{ fontSize: '20px', color: 'rgba(255,255,255,0.3)' }}>
                  admin_panel_settings
                </span>
                <input
                  id="admin-passcode"
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter admin PIN"
                  autoComplete="current-password"
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl text-xl text-center tracking-[0.35em] font-semibold transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `2px solid ${error ? '#fa5252' : 'rgba(255,255,255,0.12)'}`,
                    color: '#ffffff',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#4c6ef5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(76,110,245,0.2)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = error ? '#fa5252' : 'rgba(255,255,255,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {error && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium anim-fade-up" style={{ color: '#fa5252' }}>
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: '15px' }}>error</span>
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white transition-all"
              style={{
                background: loading ? 'rgba(76,110,245,0.5)' : 'linear-gradient(135deg, #364fc7 0%, #1971c2 100%)',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(76,110,245,0.4)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <span className={`material-symbols-outlined ${loading ? 'anim-spin' : ''}`} style={{ fontSize: '20px' }}>
                {loading ? 'refresh' : 'lock_open'}
              </span>
              {loading ? 'Verifying…' : 'Access Admin Panel'}
            </button>
          </form>

          <div className="mt-6 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <a href="/login" className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
            >
              ← Back to user login
            </a>
          </div>
        </div>
      </div>

      <p className="relative z-10 text-xs uppercase tracking-widest mt-8 text-center" style={{ color: 'rgba(255,255,255,0.18)' }}>
        © 2024 StockKeep · Admin Portal
      </p>
    </div>
  );
}
