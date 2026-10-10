import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, User, KeyRound, X, AlertCircle } from 'lucide-react';

export const SecretAdminModal: React.FC = () => {
  const { isSecretAdminOpen, setIsSecretAdminOpen, loginAdmin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isSecretAdminOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: identifier.trim(),
          password,
          twoFactorCode: requires2FA ? twoFactorCode.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication rejected');
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        setError(data.message || 'Please enter 2FA verification code.');
        setLoading(false);
        return;
      }

      loginAdmin(data.token, data.admin);
      setIdentifier('');
      setPassword('');
      setTwoFactorCode('');
      setRequires2FA(false);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-100">
        <button
          onClick={() => {
            setIsSecretAdminOpen(false);
            setError(null);
            setRequires2FA(false);
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Administrator Access</h2>
            <p className="text-xs text-slate-400">Restricted access node</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Admin Identity / Email
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter username or email"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Secure Key / Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>

          {requires2FA && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                Two-Factor Security Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input
                  type="text"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="Enter 6-digit verification PIN"
                  maxLength={6}
                  className="w-full bg-slate-950 border border-amber-800/60 rounded-xl py-2.5 pl-10 pr-4 text-sm text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading ? 'Verifying Credentials...' : 'Authenticate as Administrator'}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center text-[11px] text-slate-500">
          <span>Sole Admin Privilege Enforced</span>
        </div>
      </div>
    </div>
  );
};
