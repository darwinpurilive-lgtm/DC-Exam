import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, PlatformSettings } from '../types';

interface AuthContextType {
  user: User | null;
  adminUser: { username: string; email: string } | null;
  adminToken: string | null;
  studentToken: string | null;
  isSecretAdminOpen: boolean;
  setIsSecretAdminOpen: (open: boolean) => void;
  adminShortcut: string;
  loginStudent: (token: string, student: any) => void;
  loginAdmin: (token: string, admin: any) => void;
  logoutStudent: () => void;
  logoutAdmin: () => void;
  platformSettings: PlatformSettings | null;
  refreshSettings: () => Promise<void>;
  pendingStudentInfo: { email: string; fullName: string } | null;
  setPendingStudentInfo: (info: { email: string; fullName: string } | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('exam_student_user') || localStorage.getItem('apex_student_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [studentToken, setStudentToken] = useState<string | null>(() => {
    return localStorage.getItem('exam_student_token') || localStorage.getItem('apex_student_token');
  });

  const [adminUser, setAdminUser] = useState<{ username: string; email: string } | null>(() => {
    const saved = sessionStorage.getItem('exam_admin_user') || sessionStorage.getItem('apex_admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('exam_admin_token') || sessionStorage.getItem('apex_admin_token');
  });

  const [isSecretAdminOpen, setIsSecretAdminOpen] = useState(false);
  const [adminShortcut, setAdminShortcut] = useState('Ctrl+Shift+A');
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [pendingStudentInfo, setPendingStudentInfo] = useState<{ email: string; fullName: string } | null>(null);

  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setPlatformSettings(data.settings);
        if (data.settings.adminShortcut) {
          setAdminShortcut(data.settings.adminShortcut);
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  // Global listener for Secret Admin shortcut (Default: Ctrl + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse shortcut like "Ctrl+Shift+A" or "Ctrl+Alt+S"
      const parts = adminShortcut.toLowerCase().split('+').map(p => p.trim());
      const needsCtrl = parts.includes('ctrl') || parts.includes('control');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt');
      const keyPart = parts.find(p => !['ctrl', 'control', 'shift', 'alt', 'cmd', 'command'].includes(p));

      const ctrlPressed = e.ctrlKey || e.metaKey;
      const shiftPressed = e.shiftKey;
      const altPressed = e.altKey;
      const keyPressed = keyPart ? e.key.toLowerCase() === keyPart.toLowerCase() : false;

      const ctrlMatch = needsCtrl ? ctrlPressed : true;
      const shiftMatch = needsShift ? shiftPressed : true;
      const altMatch = needsAlt ? altPressed : true;

      if (ctrlMatch && shiftMatch && altMatch && keyPressed) {
        e.preventDefault();
        setIsSecretAdminOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adminShortcut]);

  const loginStudent = (token: string, student: any) => {
    setStudentToken(token);
    setUser({ ...student, role: 'student' });
    localStorage.setItem('exam_student_token', token);
    localStorage.setItem('exam_student_user', JSON.stringify({ ...student, role: 'student' }));
  };

  const logoutStudent = () => {
    setStudentToken(null);
    setUser(null);
    localStorage.removeItem('exam_student_token');
    localStorage.removeItem('exam_student_user');
    localStorage.removeItem('apex_student_token');
    localStorage.removeItem('apex_student_user');
  };

  const loginAdmin = (token: string, admin: any) => {
    setAdminToken(token);
    setAdminUser(admin);
    sessionStorage.setItem('exam_admin_token', token);
    sessionStorage.setItem('exam_admin_user', JSON.stringify(admin));
    setIsSecretAdminOpen(false);
  };

  const logoutAdmin = () => {
    setAdminToken(null);
    setAdminUser(null);
    sessionStorage.removeItem('exam_admin_token');
    sessionStorage.removeItem('exam_admin_user');
    sessionStorage.removeItem('apex_admin_token');
    sessionStorage.removeItem('apex_admin_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminUser,
        adminToken,
        studentToken,
        isSecretAdminOpen,
        setIsSecretAdminOpen,
        adminShortcut,
        loginStudent,
        loginAdmin,
        logoutStudent,
        logoutAdmin,
        platformSettings,
        refreshSettings,
        pendingStudentInfo,
        setPendingStudentInfo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
