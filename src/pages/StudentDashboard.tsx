import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Examination, Announcement } from '../types';
import {
  Trophy,
  Play,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Calendar,
  KeyRound
} from 'lucide-react';

interface Props {
  onStartExam: (examId: string) => void;
  onViewResult: (attemptId: string) => void;
  onNavigateTab: (tab: 'dashboard' | 'ai-doubt' | 'ask-institute') => void;
  onChangePassword?: () => void;
}

export const StudentDashboard: React.FC<Props> = ({ onStartExam, onViewResult, onNavigateTab, onChangePassword }) => {
  const { user, studentToken } = useAuth();

  const [exams, setExams] = useState<Examination[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentToken || !user) return;

    Promise.all([
      fetch('/api/exams', { headers: { Authorization: `Bearer ${studentToken}` } }).then(r => r.json()),
      fetch('/api/announcements', { headers: { Authorization: `Bearer ${studentToken}` } }).then(r => r.json()),
      fetch(`/api/analytics/student/${user.id}`, { headers: { Authorization: `Bearer ${studentToken}` } }).then(r => r.json())
    ])
      .then(([examData, annData, anaData]) => {
        setExams(examData.exams || []);
        setAnnouncements(annData.announcements || []);
        setAnalytics(anaData);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [studentToken, user]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading candidate dashboard...</div>;
  }

  const liveExams = exams.filter(e => {
    const now = Date.now();
    const start = new Date(e.startDate).getTime();
    const end = new Date(e.endDate).getTime();
    return e.status === 'Live' && now >= start && now <= end && (!e.studentAttempt || e.studentAttempt.status === 'in_progress');
  });

  const completedExams = exams.filter(e => e.studentAttempt && e.studentAttempt.status === 'submitted');
  const upcomingExams = exams.filter(e => {
    const now = Date.now();
    const start = new Date(e.startDate).getTime();
    return now < start;
  });

  const summary = analytics?.summary || {
    totalTests: 0,
    avgMarks: 0,
    avgPercentage: 0,
    overallAccuracy: 0,
    highestScore: 0,
    lowestScore: 0,
    recentScore: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    totalUnanswered: 0
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Announcements Banner */}
      {announcements.length > 0 && (
        <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-200">
          <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold text-white mr-1.5">{announcements[0].title}:</strong>
            <span>{announcements[0].message}</span>
          </div>
        </div>
      )}

      {/* Candidate Profile Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold font-mono text-xl flex items-center justify-center">
            {user?.fullName?.charAt(0) || 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{user?.fullName}</h1>
              <span className="text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-medium">
                {user?.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Roll ID: <strong className="text-slate-300 font-mono">{user?.registrationNumber}</strong> · Enrolled Batch: <strong className="text-indigo-400">{user?.batchName}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          {onChangePassword && (
            <button
              onClick={onChangePassword}
              className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              Change Password
            </button>
          )}
          <button
            onClick={() => onNavigateTab('ai-doubt')}
            className="flex-1 md:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            AI Doubt Solver
          </button>
          <button
            onClick={() => onNavigateTab('ask-institute')}
            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Academic Doubts
          </button>
        </div>
      </div>

      {/* Performance Overview KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-md">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Tests Attempted</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white">
            {summary.totalTests}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Live & Classroom Tests</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-md">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Average Score</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-indigo-400">
            {summary.avgPercentage}%
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Institutional Avg</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-md">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Overall Accuracy</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-cyan-400">
            {summary.overallAccuracy}%
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Correct vs Answered</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center shadow-md">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Highest Score</span>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
            {summary.highestScore}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Personal Benchmark</span>
        </div>
      </div>

      {/* Available & Live Examinations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Live & Available Examinations ({liveExams.length})
          </h2>
        </div>

        {liveExams.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No live tests currently active for your batch. Check upcoming schedule below.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveExams.map(exam => (
              <div key={exam.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Live Examination
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-[10px] font-mono text-emerald-400">
                      <Clock className="w-3 h-3" />
                      {exam.durationMinutes}m Exam Timer
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{exam.name}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{exam.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="text-indigo-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      Test Timer: <strong className="text-white font-mono">{exam.durationMinutes} mins</strong>
                    </span>
                    <span>·</span>
                    <span>Total Marks: <strong className="text-white font-mono">{exam.totalMarks}</strong></span>
                    <span>·</span>
                    <span>Questions: <strong className="text-white font-mono">{exam.questionCount || exam.questionIds.length}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => onStartExam(exam.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {exam.studentAttempt?.status === 'in_progress' ? 'Resume Examination' : 'Start Examination'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Examinations & Scorecards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-indigo-400" />
          Completed Examinations & Results ({completedExams.length})
        </h2>

        {completedExams.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            You haven't completed any examinations yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            {completedExams.map(exam => {
              const attempt = exam.studentAttempt;
              return (
                <div key={exam.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-950/40 transition-colors">
                  <div>
                    <h3 className="text-sm font-bold text-white">{exam.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Submitted: {attempt?.submittedTime ? new Date(attempt.submittedTime).toLocaleDateString() : 'Recorded'}</span>
                      <span>·</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        Score: {attempt?.score} ({attempt?.percentage}%)
                      </span>
                    </div>
                  </div>

                  {attempt?.id && (
                    <button
                      onClick={() => onViewResult(attempt.id)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Scorecard
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
