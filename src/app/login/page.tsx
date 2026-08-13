'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) {
      setError('Please enter your passcode');
      triggerShake();
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();
      if (res.ok) {
        fetch('/api/seed', { method: 'POST' }).catch(() => {});
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Incorrect passcode, try again');
        triggerShake();
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f6] flex flex-col items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#005440]/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#005440]/5 blur-3xl" />
      </div>

      <div className={`login-card bg-white rounded-2xl w-full max-w-sm p-8 relative z-10 anim-fade-up ${shake ? 'anim-shake' : ''}`}>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0f6e56] to-[#005440] flex items-center justify-center shadow-lg mb-4">
            <span className="material-symbols-outlined icon-fill text-[#9aedcf]" style={{ fontSize: '32px' }}>
              inventory_2
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#191c1d] tracking-tight">StockKeep</h1>
          <p className="text-sm text-[#6b7775] mt-1">Shop Inventory Alert System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-[#191c1d] mb-2" htmlFor="passcode">
              Passcode
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aafaa]" style={{ fontSize: '20px' }}>
                lock
              </span>
              <input
                id="passcode"
                type={showPassword ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter PIN"
                maxLength={8}
                autoComplete="current-password"
                className={`w-full pl-11 pr-12 py-3.5 bg-[#f8f9fa] border-2 ${
                  error ? 'border-red-400 bg-red-50' : 'border-[#e5e7eb]'
                } rounded-xl text-xl text-center tracking-[0.35em] font-semibold text-[#191c1d] transition-all`}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9aafaa] hover:text-[#005440] transition-colors p-1"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>

            {error && (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-600 anim-fade-up">
                <span className="material-symbols-outlined icon-fill" style={{ fontSize: '15px' }}>error</span>
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold"
          >
            <span className={`material-symbols-outlined ${loading ? 'anim-spin' : ''}`} style={{ fontSize: '20px' }}>
              {loading ? 'refresh' : 'lock_open'}
            </span>
            {loading ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <p className="text-center text-xs text-[#9aafaa] mt-6">
          First time here? The initial passcode is{' '}
          <strong className="text-[#005440] font-semibold">1234</strong>{' '}
          — change it under Settings after logging in.
        </p>
      </div>

      <p className="text-xs text-[#bec9c3] uppercase tracking-widest mt-8 text-center">
        © 2024 StockKeep · Inventory Alert System
      </p>
    </div>
  );
}
