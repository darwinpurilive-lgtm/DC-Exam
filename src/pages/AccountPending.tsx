import React from 'react';
import { Clock, ShieldAlert, CheckCircle, ArrowLeft } from 'lucide-react';

interface Props {
  fullName?: string;
  email?: string;
  onBackToLogin: () => void;
}

export const AccountPending: React.FC<Props> = ({ fullName, email, onBackToLogin }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-6">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Registration Pending Approval</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          {fullName ? `Thank you, ${fullName}. ` : ''}
          Your registration has been recorded and submitted to administration for verification.
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-left text-xs space-y-2.5 mb-6 text-slate-300">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold uppercase tracking-wider text-[11px]">
            <ShieldAlert className="w-4 h-4" />
            <span>Verification in Progress</span>
          </div>
          <p className="text-slate-400">
            For competitive integrity, examination access is restricted to approved students only.
          </p>
          <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-slate-400">
            <span>Registered Email:</span>
            <span className="font-mono text-white text-[11px]">{email || 'Submitted email'}</span>
          </div>
        </div>

        <button
          onClick={onBackToLogin}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    </div>
  );
};
