import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { StudentDoubt } from '../types';
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, FileText, Send, Paperclip } from 'lucide-react';

export const AskMyInstitute: React.FC = () => {
  const { studentToken } = useAuth();
  const [doubts, setDoubts] = useState<StudentDoubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  const [formData, setFormData] = useState({
    subject: 'Math',
    title: '',
    question: '',
    imageUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDoubts = async () => {
    try {
      const res = await fetch('/api/doubts', {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDoubts(data.doubts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoubts();
  }, [studentToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/doubts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit doubt');

      setShowNewModal(false);
      setFormData({ subject: 'Math', title: '', question: '', imageUrl: '' });
      fetchDoubts();
    } catch (err: any) {
      setError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: StudentDoubt['status']) => {
    switch (status) {
      case 'Answered':
        return <span className="text-emerald-400 font-semibold text-xs">Answered by Administrator</span>;
      case 'In Review':
        return <span className="text-indigo-400 font-semibold text-xs">Faculty In Review</span>;
      case 'Closed':
        return <span className="text-slate-400 font-semibold text-xs">Ticket Closed</span>;
      default:
        return <span className="text-amber-400 font-semibold text-xs">Pending Faculty Review</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            <span>Direct Faculty Channel</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Faculty Doubts & Helpdesk</h1>
          <p className="text-xs text-slate-400 mt-1">
            Submit questions, conceptual doubts, or evaluation grievances directly to the faculty administrator.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Submit Personal Doubt
        </button>
      </div>

      {/* Doubts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading doubt tickets...</div>
        ) : doubts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-sm">
            You haven't submitted any doubts yet. Click <strong>Submit Personal Doubt</strong> above to reach the administrator.
          </div>
        ) : (
          doubts.map(d => (
            <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-400 font-mono">{d.subject}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{new Date(d.createdAt).toLocaleDateString()}</span>
                </div>
                <div>{getStatusBadge(d.status)}</div>
              </div>

              <h3 className="text-base font-bold text-white">{d.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{d.question}</p>

              {d.imageUrl && (
                <div className="pt-2">
                  <img src={d.imageUrl} alt="Attachment" className="max-h-48 rounded-lg border border-slate-800 object-contain" />
                </div>
              )}

              {/* Admin Faculty Reply */}
              {d.adminReply ? (
                <div className="mt-4 p-4 bg-slate-950 border border-indigo-900/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-indigo-400 font-semibold">
                    <span>Faculty Answer:</span>
                    {d.repliedAt && <span className="font-mono text-slate-500">{new Date(d.repliedAt).toLocaleDateString()}</span>}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{d.adminReply}</p>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Awaiting administrator response</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Doubt Submission Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">Submit Doubt to Administrator</h2>
            <p className="text-xs text-slate-400 mb-5">Your doubt will be queued directly in the administrator panel.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-950/50 border border-red-900 rounded-xl text-red-200 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Subject
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Math">Math</option>
                  <option value="Reasoning">Reasoning</option>
                  <option value="GK">GK</option>
                  <option value="Current Affairs">Current Affairs</option>
                  <option value="English">English</option>
                  <option value="Computer">Computer</option>
                  <option value="Exam Grievance">Exam / Score Evaluation Grievance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Doubt Title / Topic
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Question on Angular Momentum in Test 01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Detailed Question Statement
                </label>
                <textarea
                  rows={4}
                  required
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  placeholder="Specify the problem statement, derivation doubt, or question number..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  {submitting ? 'Submitting...' : 'Submit Doubt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
