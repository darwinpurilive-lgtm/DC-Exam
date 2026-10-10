import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Trophy,
  CheckCircle,
  XCircle,
  HelpCircle,
  Printer,
  ArrowLeft,
  Award,
  TrendingUp,
  Percent,
  Clock,
  BookOpen
} from 'lucide-react';

interface Props {
  attemptId: string;
  onBack: () => void;
}

export const ResultScorecard: React.FC<Props> = ({ attemptId, onBack }) => {
  const { studentToken, adminToken } = useAuth();
  const token = adminToken || studentToken;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/results/${attemptId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch(err => setError(err.message || 'Failed to load examination result'))
      .finally(() => setLoading(false));
  }, [attemptId, token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Generating Scorecard & Evaluation Report...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
          <p className="text-red-400 mb-4 text-sm">{error || 'Result not available'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Print Actions */}
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF Scorecard
          </button>
        </div>

        {/* Scorecard Hero Banner */}
        <div className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 print:border-slate-200 pb-6 mb-6">
            <div>
              <span className="text-xs uppercase font-mono tracking-widest text-indigo-400 print:text-indigo-700 font-bold block mb-1">
                Official Examination Scorecard
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white print:text-black">
                {data.exam.name}
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Candidate: <strong className="text-white print:text-black">{data.student.fullName}</strong> · ID: {data.student.registrationNumber} · Batch: {data.student.batchName}
              </p>
            </div>

            <div className="text-right sm:text-right w-full sm:w-auto">
              <span className="text-[11px] text-slate-500 print:text-slate-600 block">Submitted On</span>
              <span className="text-xs font-mono text-slate-300 print:text-black">
                {new Date(data.submittedTime).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-950 print:bg-slate-100 p-4 rounded-2xl border border-slate-800 print:border-slate-300 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-600 block mb-1">Marks Obtained</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 print:text-emerald-700">
                {data.score} <span className="text-xs text-slate-500 font-normal">/ {data.maxScore}</span>
              </div>
            </div>

            <div className="bg-slate-950 print:bg-slate-100 p-4 rounded-2xl border border-slate-800 print:border-slate-300 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-600 block mb-1">Percentage</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-400 print:text-indigo-700">
                {data.percentage}%
              </div>
            </div>

            <div className="bg-slate-950 print:bg-slate-100 p-4 rounded-2xl border border-slate-800 print:border-slate-300 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-600 block mb-1">Accuracy</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-400 print:text-cyan-700">
                {data.accuracy}%
              </div>
            </div>

            <div className="bg-slate-950 print:bg-slate-100 p-4 rounded-2xl border border-slate-800 print:border-slate-300 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 print:text-slate-600 block mb-1">
                {data.rank ? 'Rank / Percentile' : 'Deductions'}
              </span>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 print:text-amber-700">
                {data.rank ? `#${data.rank} (${data.percentile}%)` : `-${data.negativeDeductions || 0} Deductions`}
              </div>
            </div>
          </div>

          {/* Attempt Breakdown Counters */}
          <div className="flex flex-wrap items-center justify-around bg-slate-950/60 print:bg-slate-50 p-4 rounded-2xl border border-slate-800/80 print:border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 print:text-emerald-600" />
              <span>Correct: <strong className="text-white print:text-black font-mono">{data.correctCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 print:text-red-600" />
              <span>Incorrect: <strong className="text-white print:text-black font-mono">{data.incorrectCount}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-slate-400 print:text-slate-600" />
              <span>Unanswered: <strong className="text-white print:text-black font-mono">{data.unansweredCount}</strong></span>
            </div>
          </div>
        </div>

        {/* Question by Question Detailed Solutions (if released) */}
        {data.isReleased && data.questionBreakdown && (
          <div className="bg-slate-900 print:bg-white border border-slate-800 print:border-slate-300 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="border-b border-slate-800 print:border-slate-200 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white print:text-black">Detailed Solutions & Explanations</h2>
                <p className="text-xs text-slate-400 print:text-slate-600">Review correct derivations, traps, and submitted responses.</p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {data.questionBreakdown.length} Questions
              </span>
            </div>

            <div className="space-y-6">
              {data.questionBreakdown.map((q: any) => {
                const selectedOpt = q.options.find((o: any) => o.id === q.selectedOptionId);
                const correctOpt = q.options.find((o: any) => o.id === q.correctAnswerId);

                return (
                  <div
                    key={q.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      q.isCorrect
                        ? 'bg-emerald-950/20 border-emerald-800/40 print:bg-slate-50'
                        : q.isAnswered
                        ? 'bg-red-950/20 border-red-800/40 print:bg-slate-50'
                        : 'bg-slate-950/40 border-slate-800 print:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white print:text-black font-mono">Q{q.qNo}.</span>
                        <span>{q.subject} · {q.topic}</span>
                      </div>
                      <div>
                        {q.isCorrect ? (
                          <span className="text-emerald-400 font-semibold font-mono">+{q.marks} Marks (Correct)</span>
                        ) : q.isAnswered ? (
                          <span className="text-red-400 font-semibold font-mono">-{q.negativeMarks} Deducted (Incorrect)</span>
                        ) : (
                          <span className="text-slate-400 font-mono">0 Marks (Unanswered)</span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm font-medium text-slate-100 print:text-black mb-4 whitespace-pre-wrap leading-relaxed">
                      {q.text}
                    </div>

                    {q.imageUrl && (
                      <div className="max-w-xs mb-4 rounded-lg overflow-hidden border border-slate-800 p-1">
                        <img src={q.imageUrl} alt="Diagram" className="max-h-48 object-contain" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                      {q.options.map((opt: any, oIdx: number) => {
                        const letter = ['A', 'B', 'C', 'D', 'E', 'F'][oIdx] || `${oIdx + 1}`;
                        const isThisSelected = opt.id === q.selectedOptionId;
                        const isThisCorrect = opt.id === q.correctAnswerId;

                        let optClass = 'bg-slate-900 print:bg-white border-slate-800 text-slate-300 print:text-black';
                        if (isThisCorrect) {
                          optClass = 'bg-emerald-950/40 border-emerald-600 text-emerald-200 print:bg-emerald-50 print:text-emerald-800 font-medium';
                        } else if (isThisSelected) {
                          optClass = 'bg-red-950/40 border-red-600 text-red-200 print:bg-red-50 print:text-red-800';
                        }

                        return (
                          <div key={opt.id} className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${optClass}`}>
                            <span className="font-bold font-mono shrink-0">{letter}.</span>
                            <span className="leading-relaxed flex-1">{opt.text}</span>
                            {isThisCorrect && <span className="text-[10px] uppercase font-bold text-emerald-400 print:text-emerald-700">Correct</span>}
                            {isThisSelected && !isThisCorrect && <span className="text-[10px] uppercase font-bold text-red-400 print:text-red-700">Your Choice</span>}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-3 p-3.5 bg-slate-950 print:bg-slate-100 rounded-xl border border-slate-800 print:border-slate-300 text-xs text-slate-300 print:text-slate-800">
                        <span className="font-bold text-indigo-400 print:text-indigo-700 block mb-1">
                          Faculty Scientific Explanation:
                        </span>
                        <p className="leading-relaxed">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
