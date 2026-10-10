import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { SecretAdminModal } from './components/SecretAdminModal';
import { StudentLogin } from './pages/StudentLogin';
import { StudentRegistration } from './pages/StudentRegistration';
import { AccountPending } from './pages/AccountPending';
import { StudentDashboard } from './pages/StudentDashboard';
import { OnlineExamRunner } from './pages/OnlineExamRunner';
import { ResultScorecard } from './pages/ResultScorecard';
import { AIDoubtSolver } from './pages/AIDoubtSolver';
import { AskMyInstitute } from './pages/AskMyInstitute';
import { AdminPortal } from './pages/admin/AdminPortal';
import { NotificationCenter } from './components/NotificationCenter';
import { StudentChangePasswordModal } from './components/StudentChangePasswordModal';
import {
  LayoutDashboard,
  Sparkles,
  MessageSquare,
  LogOut,
  User,
  KeyRound
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, adminToken, logoutStudent, pendingStudentInfo, setPendingStudentInfo } = useAuth();

  // Navigation state
  const [authView, setAuthView] = useState<'login' | 'register' | 'pending'>('login');
  const [studentTab, setStudentTab] = useState<'dashboard' | 'ai-doubt' | 'ask-institute'>('dashboard');
  const [isStudentPasswordOpen, setIsStudentPasswordOpen] = useState(false);

  // Active examination runner state
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Result scorecard state
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  // 1. If Administrator is logged in, show Admin Portal (with preview capability)
  if (adminToken) {
    if (activeExamId && isPreviewMode) {
      return (
        <OnlineExamRunner
          examId={activeExamId}
          previewMode={true}
          onExamCompleted={() => {
            setActiveExamId(null);
            setIsPreviewMode(false);
          }}
          onExitPreview={() => {
            setActiveExamId(null);
            setIsPreviewMode(false);
          }}
        />
      );
    }

    return (
      <AdminPortal
        onPreviewExam={(examId) => {
          setActiveExamId(examId);
          setIsPreviewMode(true);
        }}
      />
    );
  }

  // 2. If student is taking an active examination
  if (activeExamId && user) {
    return (
      <OnlineExamRunner
        examId={activeExamId}
        onExamCompleted={(attemptId) => {
          setActiveExamId(null);
          setActiveAttemptId(attemptId);
        }}
      />
    );
  }

  // 3. If student is viewing a result scorecard
  if (activeAttemptId && user) {
    return (
      <ResultScorecard
        attemptId={activeAttemptId}
        onBack={() => setActiveAttemptId(null)}
      />
    );
  }

  // 4. If student is NOT logged in
  if (!user) {
    if (authView === 'pending' || pendingStudentInfo) {
      return (
        <>
          <div className="fixed top-4 right-4 z-40">
            <ThemeSwitcher />
          </div>
          <SecretAdminModal />
          <AccountPending
            fullName={pendingStudentInfo?.fullName}
            email={pendingStudentInfo?.email}
            onBackToLogin={() => {
              setPendingStudentInfo(null);
              setAuthView('login');
            }}
          />
        </>
      );
    }

    if (authView === 'register') {
      return (
        <>
          <div className="fixed top-4 right-4 z-40">
            <ThemeSwitcher />
          </div>
          <SecretAdminModal />
          <StudentRegistration
            onSwitchToLogin={() => setAuthView('login')}
            onRegisteredPending={(info) => {
              setPendingStudentInfo(info);
              setAuthView('pending');
            }}
          />
        </>
      );
    }

    return (
      <>
        <div className="fixed top-4 right-4 z-40">
          <ThemeSwitcher />
        </div>
        <SecretAdminModal />
        <StudentLogin
          onSwitchToRegister={() => setAuthView('register')}
          onPendingStatus={(info) => {
            setPendingStudentInfo(info);
            setAuthView('pending');
          }}
        />
      </>
    );
  }

  // 5. Authenticated Student Portal (Clean, zero logo, zero name, zero bulky headbar panel)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Secret admin modal accessible via Ctrl+Shift+A keyboard shortcut */}
      <SecretAdminModal />

      {/* Sleek Minimalist Navigation Bar - No Logo, No Name, No Bulky Headbar Panel */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setStudentTab('dashboard')}
            className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
              studentTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setStudentTab('ai-doubt')}
            className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
              studentTab === 'ai-doubt'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Doubt Solver</span>
          </button>

          <button
            onClick={() => setStudentTab('ask-institute')}
            className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
              studentTab === 'ask-institute'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Academic Doubts</span>
          </button>
        </nav>

        {/* Right Utility Controls: Theme Switcher, Notifications, Change Password, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <NotificationCenter />

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-xs">
            <div className="text-right hidden md:block mr-1">
              <span className="font-semibold text-slate-200 block">{user.fullName}</span>
              <span className="text-[10px] text-slate-500 font-mono">{user.registrationNumber}</span>
            </div>
            <button
              onClick={() => setIsStudentPasswordOpen(true)}
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Change Password"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={logoutStudent}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <StudentChangePasswordModal
        isOpen={isStudentPasswordOpen}
        onClose={() => setIsStudentPasswordOpen(false)}
      />

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 pb-12">
        {studentTab === 'dashboard' && (
          <StudentDashboard
            onStartExam={(id) => setActiveExamId(id)}
            onViewResult={(id) => setActiveAttemptId(id)}
            onNavigateTab={(tab) => setStudentTab(tab)}
            onChangePassword={() => setIsStudentPasswordOpen(true)}
          />
        )}
        {studentTab === 'ai-doubt' && <AIDoubtSolver />}
        {studentTab === 'ask-institute' && <AskMyInstitute />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
