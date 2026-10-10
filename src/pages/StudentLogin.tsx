import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, ArrowRight, AlertCircle, Sparkles, BookOpen } from 'lucide-react';

interface Props {
  onSwitchToRegister: () => void;
  onPendingStatus: (info: { fullName: string; email: string }) => void;
}

export const StudentLogin: React.FC<Props> = ({ onSwitchToRegister, onPendingStatus }) => {
  const { loginStudent } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.status === 'Pending') {
          onPendingStatus({
            fullName: data.student?.fullName || identifier,
            email: data.student?.email || identifier
          });
          return;
        }
        if (data.status === 'Rejected') {
          throw new Error(
            data.rejectionReason
              ? `Registration Rejected: ${data.rejectionReason}. Please contact the administrator.`
              : 'Registration Rejected: Application does not meet eligibility criteria.'
          );
        }
        throw new Error(data.error || 'Failed to authenticate');
      }

      loginStudent(data.token, data.student);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4 shadow-lg shadow-indigo-950/50">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Student Examination Portal</h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400">
            Sign in to access your examinations, scorecards, and doubt solver.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl p-6 sm:p-8">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Registration No. or Email
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Registration No. or Email"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm"
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              New candidate?{' '}
              <button
                onClick={onSwitchToRegister}
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 ml-1"
              >
                Register Here
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-[11px] text-slate-600">
          Competitive Examination Platform · Strictly Authenticated Examination System
        </div>
      </div>
    </div>
  );
};
