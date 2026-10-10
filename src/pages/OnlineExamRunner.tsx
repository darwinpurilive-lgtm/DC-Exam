import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Question, StudentAnswer } from '../types';
import {
  Clock,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Send,
  AlertTriangle,
  Menu,
  X,
  Maximize,
  ShieldAlert
} from 'lucide-react';

interface Props {
  examId: string;
  previewMode?: boolean;
  onExamCompleted: (attemptId: string) => void;
  onExitPreview?: () => void;
}

export const OnlineExamRunner: React.FC<Props> = ({
  examId,
  previewMode = false,
  onExamCompleted,
  onExitPreview
}) => {
  const { studentToken, adminToken } = useAuth();
  const token = previewMode ? adminToken : studentToken;

  // State phases: 'instructions' -> 'active' -> 'submitting'
  const [phase, setPhase] = useState<'instructions' | 'active' | 'submitting'>('instructions');
  const [instructionsRead, setInstructionsRead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exam details & Authoritative session state
  const [attemptId, setAttemptId] = useState<string>('');
  const [examName, setExamName] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalExamSeconds, setTotalExamSeconds] = useState<number>(3600);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [timerWarnings, setTimerWarnings] = useState({
    visualWarningMinutes: 10,
    prominentWarningMinutes: 5,
    criticalWarningMinutes: 1
  });
  const [securitySettings, setSecuritySettings] = useState({
    fullScreenRequired: true,
    disableCopyPaste: true,
    trackTabSwitches: true
  });

  // UI state
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isTimeUpModal, setIsTimeUpModal] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);

  // Local authoritative timer calculation
  const deadlineRef = useRef<number>(0);
  const syncIntervalRef = useRef<any>(null);
  const autoSaveIntervalRef = useRef<any>(null);

  // Start exam API
  const handleStartExam = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/exam-session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ examId, previewMode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start examination session');
      }

      setAttemptId(data.attemptId);
      setExamName(data.examName);
      setQuestions(data.questions || []);
      setRemainingSeconds(data.remainingSeconds);
      setTotalExamSeconds(data.remainingSeconds || 3600);
      deadlineRef.current = Date.now() + data.remainingSeconds * 1000;
      setAnswers(data.savedAnswers || {});

      if (data.timerWarnings) setTimerWarnings(data.timerWarnings);
      if (data.security) setSecuritySettings(data.security);

      setPhase('active');
    } catch (err: any) {
      setError(err.message || 'Error initializing exam session');
    } finally {
      setLoading(false);
    }
  };

  // Timer Tick & Authoritative Server Sync
  useEffect(() => {
    if (phase !== 'active' || isTimerPaused) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((deadlineRef.current - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        clearInterval(timer);
        // Time expired -> show modal and auto submit!
        setIsTimeUpModal(true);
        setTimeout(() => {
          handleFinalSubmit(true);
        }, 1200);
      }
    }, 1000);

    // Sync with server every 20 seconds to prevent clock manipulation
    if (!previewMode && attemptId && attemptId !== 'preview_attempt') {
      syncIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/exam-session/${attemptId}/sync`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.remainingSeconds !== undefined) {
              setRemainingSeconds(data.remainingSeconds);
              deadlineRef.current = Date.now() + data.remainingSeconds * 1000;
            }
          }
        } catch (e) {
          // Silent network recovery
        }
      }, 20000);
    }

    return () => {
      clearInterval(timer);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [phase, attemptId, previewMode]);

  // Periodic Auto-save every 8 seconds
  useEffect(() => {
    if (phase !== 'active' || previewMode || !attemptId || attemptId === 'preview_attempt') return;

    autoSaveIntervalRef.current = setInterval(() => {
      triggerAutosave(answers);
    }, 8000);

    return () => {
      if (autoSaveIntervalRef.current) clearInterval(autoSaveIntervalRef.current);
    };
  }, [phase, answers, attemptId, previewMode]);

  // Tab switch & visibility change listener
  useEffect(() => {
    if (phase !== 'active' || previewMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden && securitySettings.trackTabSwitches) {
        setTabSwitches(prev => prev + 1);
        if (attemptId && attemptId !== 'preview_attempt') {
          fetch(`/api/exam-session/${attemptId}/tab-switch`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [phase, attemptId, securitySettings, previewMode]);

  // Autosave payload trigger
  const triggerAutosave = async (currentAnswers: Record<string, StudentAnswer>) => {
    if (previewMode || !attemptId || attemptId === 'preview_attempt') return;
    setIsAutosaving(true);
    try {
      const res = await fetch(`/api/exam-session/${attemptId}/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers: currentAnswers })
      });
      if (res.ok) {
        const data = await res.json();
        setLastSavedTime(data.savedAt || new Date().toISOString());
      }
    } catch (e) {
      console.warn('Autosave sync queued for retry');
    } finally {
      setIsAutosaving(false);
    }
  };

  // Option selection
  const handleSelectOption = (optionId: string) => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: {
        questionId: currentQ.id,
        selectedOptionId: optionId,
        markedForReview: answers[currentQ.id]?.markedForReview || false,
        timeSpentSeconds: (answers[currentQ.id]?.timeSpentSeconds || 0) + 1,
        lastSavedAt: new Date().toISOString()
      }
    };

    setAnswers(updatedAnswers);
    triggerAutosave(updatedAnswers);
  };

  // Clear answer
  const handleClearAnswer = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const updatedAnswers = { ...answers };
    if (updatedAnswers[currentQ.id]) {
      updatedAnswers[currentQ.id] = {
        ...updatedAnswers[currentQ.id],
        selectedOptionId: null
      };
      setAnswers(updatedAnswers);
      triggerAutosave(updatedAnswers);
    }
  };

  // Toggle mark for review
  const handleToggleReview = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const currentAns = answers[currentQ.id] || {
      questionId: currentQ.id,
      selectedOptionId: null,
      markedForReview: false,
      timeSpentSeconds: 0
    };

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: {
        ...currentAns,
        markedForReview: !currentAns.markedForReview,
        lastSavedAt: new Date().toISOString()
      }
    };

    setAnswers(updatedAnswers);
    triggerAutosave(updatedAnswers);
  };

  // Final submission
  const handleFinalSubmit = async (autoSubmitted = false) => {
    if (previewMode) {
      if (onExitPreview) onExitPreview();
      return;
    }

    setPhase('submitting');
    setShowSubmitModal(false);

    try {
      const res = await fetch(`/api/exam-session/${attemptId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit examination');
      }

      onExamCompleted(attemptId);
    } catch (err: any) {
      setError(err.message || 'Submission error');
      setPhase('active');
    }
  };

  // Summary counts
  const answeredCount = Object.values(answers).filter(a => a.selectedOptionId).length;
  const reviewCount = Object.values(answers).filter(a => a.markedForReview).length;
  const unansweredCount = questions.length - answeredCount;

  // Format seconds to HH:MM:SS
  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Color warning state for timer
  const minutesLeft = Math.floor(remainingSeconds / 60);
  const timePercentRemaining = totalExamSeconds > 0
    ? Math.min(100, Math.max(0, Math.round((remainingSeconds / totalExamSeconds) * 100)))
    : 100;

  let timerColorClass = 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-800';
  let timerProgressBarColor = 'bg-emerald-500';
  let timerStatusText = 'Timer Running · Steady Pace';

  if (minutesLeft < timerWarnings.criticalWarningMinutes) {
    timerColorClass = 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/80 border-red-500 animate-pulse';
    timerProgressBarColor = 'bg-red-500 animate-pulse';
    timerStatusText = 'Critical: Final Minutes · Auto-submitting soon';
  } else if (minutesLeft < timerWarnings.prominentWarningMinutes) {
    timerColorClass = 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/70 border-orange-400';
    timerProgressBarColor = 'bg-orange-500';
    timerStatusText = 'Warning: Under 5 Minutes Remaining';
  } else if (minutesLeft < timerWarnings.visualWarningMinutes) {
    timerColorClass = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-400';
    timerProgressBarColor = 'bg-amber-500';
    timerStatusText = '10-Minute Warning · Review Responses';
  }

  // Preview Mode Timer Controls
  const handleToggleTimerPause = () => {
    if (!previewMode) return;
    if (isTimerPaused) {
      deadlineRef.current = Date.now() + remainingSeconds * 1000;
      setIsTimerPaused(false);
    } else {
      setIsTimerPaused(true);
    }
  };

  const handleAddFiveMinutes = () => {
    if (!previewMode) return;
    const newSeconds = remainingSeconds + 300;
    setRemainingSeconds(newSeconds);
    setTotalExamSeconds(prev => Math.max(prev, newSeconds));
    deadlineRef.current = Date.now() + newSeconds * 1000;
  };

  // Question palette status for index
  const getPaletteStatus = (q: Question) => {
    const ans = answers[q.id];
    const isAns = Boolean(ans?.selectedOptionId);
    const isRev = Boolean(ans?.markedForReview);

    if (isAns && isRev) return 'bg-purple-600 text-white';
    if (isRev) return 'bg-amber-500 text-slate-950 font-bold';
    if (isAns) return 'bg-emerald-600 text-white';
    return 'bg-slate-800 text-slate-400 border border-slate-700';
  };

  // Phase 1: Exam Instructions Page
  if (phase === 'instructions') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="border-b border-slate-800 pb-5 mb-6">
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold block mb-1">
              Examination Instructions
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">General Candidate Guidelines</h1>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-200 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 text-sm text-slate-300 leading-relaxed mb-8">
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 space-y-2">
              <h3 className="font-semibold text-white text-base">Key Test Specifications:</h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                <li>Server-Authoritative Timer: The countdown begins as soon as you click <strong>Start Examination</strong>.</li>
                <li>Reliable Autosave: Every answer selected or modified is automatically synchronized with the server.</li>
                <li>Negative Marking: Incorrect responses incur deductions as specified for this competitive paper.</li>
                <li>Question Palette: You can jump to any question, mark questions for review, or clear selections anytime.</li>
                <li>Automatic Submission: When the timer expires, the test submits automatically with saved responses.</li>
              </ul>
            </div>

            <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-2xl text-xs text-amber-300/90 space-y-2">
              <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[11px]">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Anti-Cheating & Integrity Deterrents</span>
              </div>
              <p>
                Tab switching, browser minimizes, and window defocus events are logged. Keep the examination window active in full screen.
              </p>
            </div>

            <label className="flex items-start gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-950 transition-colors">
              <input
                type="checkbox"
                checked={instructionsRead}
                onChange={(e) => setInstructionsRead(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs text-slate-300">
                I have read, understood, and agreed to abide by all the examination instructions and rules. I confirm I will maintain competitive honesty throughout.
              </span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {previewMode && onExitPreview && (
              <button
                onClick={onExitPreview}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
              >
                Exit Preview
              </button>
            )}
            <button
              onClick={handleStartExam}
              disabled={!instructionsRead || loading}
              className="w-full sm:w-auto ml-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading ? 'Initializing Session...' : 'Start Examination'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* 
        MANDATORY HEADER SPECIFICATION:
        Do NOT show: Logo, Institute branding, Advertisement, Unnecessary navigation.
        Display ONLY: ANSWER & COMPETE on a translucent/glass-style background.
      */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base font-bold tracking-widest uppercase text-white/90 font-mono">
            ANSWER & COMPETE
          </span>
          {previewMode && (
            <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded font-mono">
              ADMIN PREVIEW
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Server Synchronized Countdown Timer */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm tracking-wider shadow-sm transition-all ${timerColorClass}`}
            title={`Exam Timer: ${formatTimer(remainingSeconds)} remaining (${timePercentRemaining}%)`}
          >
            <Clock className="w-4 h-4 shrink-0 animate-spin-slow" />
            <span className="hidden sm:inline text-[11px] font-sans uppercase tracking-wider text-slate-500 dark:text-slate-400">
              TIME LEFT:
            </span>
            <span>{formatTimer(remainingSeconds)}</span>
          </div>

          {/* Palette drawer toggle for mobile */}
          <button
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl"
            title="Question Palette"
          >
            {isPaletteOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Real-time Exam Duration Progress Bar */}
      <div className="w-full bg-slate-800/40 h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${timerProgressBarColor}`}
          style={{ width: `${timePercentRemaining}%` }}
        />
      </div>

      {/* Exam Timer & Status HUD Strip */}
      <div className="bg-slate-900/90 border-b border-slate-800/70 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-400">
          <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{examName}</span>
          <span>·</span>
          <span>
            Q <strong className="text-white">{currentIndex + 1}</strong> of {questions.length}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline text-emerald-400">
            {answeredCount} Answered
          </span>
          {reviewCount > 0 && (
            <span className="hidden sm:inline text-amber-400">
              · {reviewCount} Review
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Timer status badge */}
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${timerColorClass}`}>
            {timerStatusText}
          </span>

          {/* Preview mode timer testing controls */}
          {previewMode && (
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <button
                onClick={handleToggleTimerPause}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded-lg border border-slate-700 transition-colors"
                title={isTimerPaused ? 'Resume Countdown' : 'Pause Countdown'}
              >
                {isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
              </button>
              <button
                onClick={handleAddFiveMinutes}
                className="px-2 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 text-[11px] rounded-lg border border-indigo-800 transition-colors"
                title="Add 5 Minutes to Timer for Testing"
              >
                +5 Min
              </button>
            </div>
          )}

          {/* Autosave sync status */}
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${isAutosaving ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
            <span className="hidden md:inline">{isAutosaving ? 'Autosaving...' : 'Responses Saved'}</span>
          </div>
        </div>
      </div>

      {/* Main Examination Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Active Question Panel */}
        <main className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Question Sub-header */}
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span>·</span>
              <span>{currentQ?.subject || 'Subject'}</span>
              {currentQ?.topic && (
                <>
                  <span>·</span>
                  <span>{currentQ.topic}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-mono">+{currentQ?.marks || 4} Marks</span>
              {currentQ?.negativeMarks ? (
                <span className="text-red-400 font-mono">-{currentQ.negativeMarks} Negative</span>
              ) : null}
            </div>
          </div>

          {/* Question Statement & Options */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {currentQ?.imageUrl && (
              <div className="max-w-md mx-auto mb-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
                <img src={currentQ.imageUrl} alt="Question diagram" className="max-h-64 mx-auto object-contain" />
              </div>
            )}

            <div className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed whitespace-pre-wrap">
              {currentQ?.text}
            </div>

            {/* Answer Options (2 to 6 options supported) */}
            <div className="space-y-3 pt-2">
              {currentQ?.options.map((opt, oIdx) => {
                const isSelected = currentAnswer?.selectedOptionId === opt.id;
                const letter = ['A', 'B', 'C', 'D', 'E', 'F'][oIdx] || `${oIdx + 1}`;

                return (
                  <label
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {letter}
                    </div>
                    <div className="text-sm leading-relaxed flex-1 select-text">
                      {opt.text}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleReview}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  currentAnswer?.markedForReview
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                {currentAnswer?.markedForReview ? 'Marked for Review' : 'Mark for Review'}
              </button>

              <button
                onClick={handleClearAnswer}
                disabled={!currentAnswer?.selectedOptionId}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Response
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1"
                >
                  Save & Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-colors flex items-center gap-1"
                >
                  Submit Paper
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Right Side: Question Palette (Desktop view & Mobile drawer) */}
        <aside
          className={`lg:w-80 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-5 ${
            isPaletteOpen ? 'fixed inset-4 z-40 lg:static' : 'hidden lg:flex'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="font-semibold text-sm text-white">Question Palette</h3>
            <button
              onClick={() => setIsPaletteOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Palette Status Legend */}
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-4 text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-600 shrink-0" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 shrink-0" />
              <span>Unanswered ({unansweredCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
              <span>Review ({reviewCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-600 shrink-0" />
              <span>Answered+Review</span>
            </div>
          </div>

          {/* Question Grid Buttons */}
          <div className="flex-1 overflow-y-auto max-h-[360px] grid grid-cols-5 gap-2 pr-1">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const statusClass = getPaletteStatus(q);

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setIsPaletteOpen(false);
                  }}
                  className={`h-9 rounded-lg font-mono text-xs font-semibold flex items-center justify-center transition-all ${statusClass} ${
                    isCurrent ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-105' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Palette Bottom Submission Action */}
          <div className="pt-4 border-t border-slate-800 mt-4 space-y-2">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              Final Submit Examination
            </button>

            {previewMode && onExitPreview && (
              <button
                onClick={onExitPreview}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs transition-colors"
              >
                Exit Preview Mode
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Submission Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mx-auto mb-4 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Confirm Final Submission</h3>
            <p className="text-xs text-slate-400 mb-6">
              Once submitted, you will not be able to modify your answers. Please review your attempt summary:
            </p>

            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800/80 text-center mb-6">
              <div>
                <span className="block text-emerald-400 font-bold text-lg font-mono">{answeredCount}</span>
                <span className="text-[11px] text-slate-400">Answered</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold text-lg font-mono">{unansweredCount}</span>
                <span className="text-[11px] text-slate-400">Unanswered</span>
              </div>
              <div>
                <span className="block text-amber-400 font-bold text-lg font-mono">{reviewCount}</span>
                <span className="text-[11px] text-slate-400">In Review</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                Continue Test
              </button>
              <button
                onClick={() => handleFinalSubmit(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-lg transition-colors"
              >
                Yes, Submit Paper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-up Auto-submission Modal */}
      {isTimeUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-600/60 text-red-400 mx-auto flex items-center justify-center">
              <Clock className="w-8 h-8 animate-pulse text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Exam Time Expired</h3>
            <p className="text-xs text-slate-300">
              The official examination countdown timer has ended (00:00:00). All saved responses are being automatically submitted to the grading server.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              <span>Transmitting attempt data to evaluation server...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
