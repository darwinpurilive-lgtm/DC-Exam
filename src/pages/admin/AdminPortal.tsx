import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Sparkles,
  FileUp,
  FileText,
  BarChart3,
  MessageSquare,
  Settings,
  ShieldAlert,
  LogOut,
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  Key,
  Download,
  Upload,
  RefreshCw,
  Send,
  AlertTriangle,
  RotateCcw,
  X,
  KeyRound,
  FileCode,
  Database,
  Cloud,
  Server
} from 'lucide-react';
import { Student, Batch, Question, Examination, StudentDoubt, AuditLog, PlatformSettings } from '../../types';

interface Props {
  onPreviewExam: (examId: string) => void;
}

const SUBJECT_TOPIC_PRESETS: Record<string, string[]> = {
  Math: [
    'Arithmetic & Simplification',
    'Percentage & Profit Loss',
    'Ratio & Proportion',
    'Time, Work & Distance',
    'Data Interpretation (DI)',
    'Algebra & Number System',
    'Geometry & Mensuration'
  ],
  Reasoning: [
    'Syllogism & Deductions',
    'Seating Arrangement & Puzzles',
    'Coding-Decoding',
    'Blood Relations & Direction',
    'Inequalities & Ranking',
    'Analogy & Series'
  ],
  GK: [
    'Indian Polity & Constitution',
    'Indian History & Freedom Struggle',
    'Geography (India & World)',
    'General Science',
    'Odisha State GK & Heritage',
    'Static GK & Important Days'
  ],
  'Current Affairs': [
    'National & International Affairs',
    'Banking & Economic News',
    'Government Schemes & Portals',
    'Awards, Honors & Summits',
    'Sports & Championships',
    'Science & Defense News'
  ],
  English: [
    'Reading Comprehension',
    'Error Spotting & Grammar',
    'Cloze Test & Fillers',
    'Para Jumbles & Rearrangement',
    'Synonyms & Antonyms',
    'Idioms & Phrases'
  ],
  Computer: [
    'Computer Fundamentals',
    'MS Office (Word, Excel, PowerPoint)',
    'Operating Systems',
    'Computer Networks & Internet',
    'Cyber Security & Malwares'
  ]
};

export const AdminPortal: React.FC<Props> = ({ onPreviewExam }) => {
  const { adminToken, logoutAdmin, adminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'approvals'
    | 'questions'
    | 'ai-generator'
    | 'ocr-import'
    | 'exams'
    | 'analytics'
    | 'doubts'
    | 'announcements'
    | 'settings'
  >('dashboard');

  // Shared state
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Examination[]>([]);
  const [doubts, setDoubts] = useState<StudentDoubt[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Student Approval filter & search
  const [studentStatusFilter, setStudentStatusFilter] = useState('Pending');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<any>(null);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  // Question bank state
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubjectFilter, setQuestionSubjectFilter] = useState('all');
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionFormSubmitting, setQuestionFormSubmitting] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    id: '',
    text: '',
    imageUrl: '',
    subject: 'Math',
    topic: '',
    subtopic: '',
    difficulty: 'Medium' as 'Easy' | 'Medium' | 'Hard',
    marks: 4,
    negativeMarks: 1,
    questionSource: 'Examination Question Bank',
    optionCount: 4,
    options: [
      { id: 'opt_1', text: '' },
      { id: 'opt_2', text: '' },
      { id: 'opt_3', text: '' },
      { id: 'opt_4', text: '' },
    ],
    correctAnswerId: 'opt_1',
    explanation: ''
  });

  // AI Question Generator state
  const [aiGenForm, setAiGenForm] = useState({
    subject: 'Math',
    topic: 'Arithmetic & Simplification',
    subtopic: 'Percentage & Ratio',
    difficulty: 'Medium',
    count: 5,
    examType: 'SSC',
    optionCount: 4,
    aiModel: 'gemini-flash-latest'
  });
  const [aiDraftQuestions, setAiDraftQuestions] = useState<any[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    operational?: boolean;
    provider?: string;
    activeModel?: string;
    message?: string;
    availableModels?: string[];
  } | null>(null);
  const [aiStatusChecking, setAiStatusChecking] = useState(false);

  // AI Question Importer: ChatGPT Text & PDF / Document
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [importRawText, setImportRawText] = useState('');
  const [importFileBase64, setImportFileBase64] = useState<string | null>(null);
  const [importFileMime, setImportFileMime] = useState<string>('application/pdf');
  const [importFileName, setImportFileName] = useState<string>('');
  const [importSubject, setImportSubject] = useState('Math');
  const [importTopic, setImportTopic] = useState('Arithmetic & Simplification');
  const [importDifficulty, setImportDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [importMarks, setImportMarks] = useState(4);
  const [importNegativeMarks, setImportNegativeMarks] = useState(1);
  const [importAiModel, setImportAiModel] = useState('gemini-flash-latest');
  const [analyzedQuestions, setAnalyzedQuestions] = useState<any[]>([]);
  const [isAnalyzingImport, setIsAnalyzingImport] = useState(false);

  // Student Rejection Modal state
  const [rejectModalStudent, setRejectModalStudent] = useState<{ id: string; fullName: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Application does not meet enrollment criteria');

  // Student Account Delete state
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; fullName: string; regNo: string } | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Admin Change Password Modal state
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState(false);
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [adminPasswordStatus, setAdminPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [adminPasswordLoading, setAdminPasswordLoading] = useState(false);

  // Exam creation & edit state
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examQuestionSubjectFilter, setExamQuestionSubjectFilter] = useState('all');
  const [newExamData, setNewExamData] = useState<any>({
    name: '',
    description: '',
    subject: 'ALL',
    targetBatch: 'ALL',
    mode: 'online',
    durationMinutes: 60,
    totalMarks: 20,
    passingMarks: 8,
    marksPerQuestion: 4,
    negativeMarksPerQuestion: 1,
    negativeMarkingEnabled: true,
    resultReleaseMode: 'immediate',
    batchIds: ['all'],
    questionIds: []
  });

  // Doubt response state
  const [replyingDoubt, setReplyingDoubt] = useState<StudentDoubt | null>(null);
  const [doubtReplyText, setDoubtReplyText] = useState('');

  // Announcements state
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', priority: 'medium' });

  // Supabase Persistent Cloud Storage state
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseActionMsg, setSupabaseActionMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showSqlMigration, setShowSqlMigration] = useState(false);

  const fetchSupabaseStatus = async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/supabase-status', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (err) {
      // ignore
    }
  };

  // Initial Data Fetch
  const refreshAllData = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const [ovRes, stRes, qRes, exRes, dbRes, setRes, logRes] = await Promise.all([
        fetch('/api/analytics/admin', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/admin/students', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/questions', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/exams', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/doubts', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch('/api/audit-logs', { headers: { Authorization: `Bearer ${adminToken}` } }).then(r => r.json())
      ]);

      setOverview(ovRes);
      setStudents(stRes.students || []);
      setQuestions(qRes.questions || []);
      setExams(exRes.exams || []);
      setDoubts(dbRes.doubts || []);
      setSettings(setRes.settings);
      setAuditLogs(logRes.logs || []);

      const bRes = await fetch('/api/batches').then(r => r.json());
      setBatches(bRes.batches || []);

      fetch('/api/ai/status').then(r => r.json()).then(setAiStatus).catch(() => null);
      fetchSupabaseStatus();
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [adminToken]);

  // Student Approval Action
  const handleUpdateStudentStatus = async (studentId: string, status: string, customReason?: string) => {
    try {
      const res = await fetch(`/api/admin/students/${studentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status, rejectionReason: customReason })
      });
      if (res.ok) {
        setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, status: status as any, rejectionReason: customReason } : s)));
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalStudent) return;
    await handleUpdateStudentStatus(rejectModalStudent.id, 'Rejected', rejectionReason);
    setRejectModalStudent(null);
  };

  // Student Account Delete Handler
  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      const res = await fetch(`/api/admin/students/${studentToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
        if (selectedStudentForHistory?.student.id === studentToDelete.id) {
          setSelectedStudentForHistory(null);
        }
        setStudentToDelete(null);
        refreshAllData();
      } else {
        alert(data.error || 'Failed to delete student account');
      }
    } catch (e: any) {
      alert('Error deleting student account: ' + e.message);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Student Password Reset
  const handleResetPassword = async (studentId: string) => {
    const newPass = prompt('Enter new password for student:', 'Student2026!');
    if (!newPass) return;
    try {
      const res = await fetch(`/api/admin/students/${studentId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ newPassword: newPass })
      });
      if (res.ok) alert(`Password successfully reset to ${newPass}`);
    } catch (e) {
      console.error(e);
    }
  };

  // View Student Full History
  const handleViewStudentHistory = async (studentId: string) => {
    try {
      const res = await fetch(`/api/admin/students/${studentId}/history`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedStudentForHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Question Adding & Editing Handlers
  const handleOpenAddQuestion = () => {
    setQuestionFormData({
      id: '',
      text: '',
      imageUrl: '',
      subject: questionSubjectFilter !== 'all' ? questionSubjectFilter : 'Math',
      topic: '',
      subtopic: '',
      difficulty: 'Medium',
      marks: 4,
      negativeMarks: 1,
      questionSource: 'Examination Question Bank',
      optionCount: 4,
      options: [
        { id: 'opt_1', text: '' },
        { id: 'opt_2', text: '' },
        { id: 'opt_3', text: '' },
        { id: 'opt_4', text: '' },
      ],
      correctAnswerId: 'opt_1',
      explanation: ''
    });
    setShowQuestionForm(true);
  };

  const handleEditQuestion = (q: Question) => {
    setQuestionFormData({
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl || '',
      subject: q.subject,
      topic: q.topic,
      subtopic: q.subtopic || '',
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      questionSource: q.questionSource || '',
      optionCount: q.options.length,
      options: q.options.map(opt => ({ id: opt.id, text: opt.text })),
      correctAnswerId: q.correctAnswerId || q.options[0]?.id || 'opt_1',
      explanation: q.explanation || ''
    });
    setShowQuestionForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question from the Question Bank?')) return;
    try {
      const res = await fetch(`/api/questions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (res.ok) {
        setQuestions(prev => prev.filter(q => q.id !== id));
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionFormData.text.trim()) {
      alert('Please enter a question statement');
      return;
    }
    const emptyOption = questionFormData.options.find(o => !o.text.trim());
    if (emptyOption) {
      alert('Please fill out text for all options');
      return;
    }

    setQuestionFormSubmitting(true);
    try {
      const isEditing = Boolean(questionFormData.id);
      const url = isEditing ? `/api/questions/${questionFormData.id}` : '/api/questions';
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        text: questionFormData.text.trim(),
        imageUrl: questionFormData.imageUrl.trim() || undefined,
        options: questionFormData.options.map(o => ({
          id: o.id,
          text: o.text.trim(),
          isCorrect: o.id === questionFormData.correctAnswerId
        })),
        correctAnswerId: questionFormData.correctAnswerId,
        explanation: questionFormData.explanation.trim(),
        subject: questionFormData.subject,
        topic: questionFormData.topic.trim() || 'General',
        subtopic: questionFormData.subtopic.trim() || undefined,
        difficulty: questionFormData.difficulty,
        marks: Number(questionFormData.marks) || 4,
        negativeMarks: Number(questionFormData.negativeMarks) || 1,
        questionSource: questionFormData.questionSource.trim() || 'Examination Question Bank'
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save question');

      alert(isEditing ? 'Question updated successfully!' : 'Question added to Question Bank!');
      setShowQuestionForm(false);
      refreshAllData();
    } catch (err: any) {
      alert(`Error saving question: ${err.message}`);
    } finally {
      setQuestionFormSubmitting(false);
    }
  };

  // Check AI Health & Operational Status
  const checkAiHealth = async () => {
    setAiStatusChecking(true);
    try {
      const res = await fetch('/api/ai/status?probe=true');
      const data = await res.json();
      setAiStatus(data);
      return data;
    } catch (e: any) {
      const fallback = {
        operational: false,
        provider: 'Google Gemini',
        message: 'Could not connect: ' + e.message
      };
      setAiStatus(fallback);
      return fallback;
    } finally {
      setAiStatusChecking(false);
    }
  };

  // AI Question Generation Execution
  const handleRunAiGeneration = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(aiGenForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const generated = data.questions || [];
      setAiDraftQuestions(generated);
      if (generated.length > 0) {
        // Update AI status indicating successful response
        setAiStatus(prev => ({
          operational: true,
          provider: 'Google Gemini API',
          activeModel: aiGenForm.aiModel,
          availableModels: prev?.availableModels || ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
          message: `Active · Successfully generated ${generated.length} questions.`
        }));
      }
    } catch (err: any) {
      alert(`AI Question Generation Error: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  // Bulk Approve AI Questions into Question Bank
  const handleApproveAiQuestions = async () => {
    if (!aiDraftQuestions.length) return;
    try {
      const res = await fetch('/api/questions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ questions: aiDraftQuestions })
      });
      if (res.ok) {
        alert(`Successfully approved and added ${aiDraftQuestions.length} questions into Question Bank!`);
        setAiDraftQuestions([]);
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run AI Question Analysis (ChatGPT text & PDF / Document)
  const handleRunAiAnalysis = async () => {
    if (importMode === 'text' && !importRawText.trim()) {
      alert('Please paste ChatGPT generated text or question statements first.');
      return;
    }
    if (importMode === 'file' && !importFileBase64) {
      alert('Please select a PDF document or question paper image to upload.');
      return;
    }

    setIsAnalyzingImport(true);
    try {
      const res = await fetch('/api/ai/analyze-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          rawText: importMode === 'text' ? importRawText.trim() : undefined,
          base64Data: importMode === 'file' ? importFileBase64 : undefined,
          mimeType: importFileMime,
          subjectHint: importSubject,
          defaultTopic: importTopic,
          defaultMarks: Number(importMarks) || 4,
          defaultNegativeMarks: Number(importNegativeMarks) || 1,
          aiModel: importAiModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze content');
      if (!data.questions || !data.questions.length) {
        alert('No questions could be extracted. Please check the text or document and try again.');
        return;
      }
      setAnalyzedQuestions(data.questions);
    } catch (err: any) {
      alert(`AI Import Analysis Error: ${err.message}`);
    } finally {
      setIsAnalyzingImport(false);
    }
  };

  // Add Single Question from Analyzed List to Question Bank
  const handleAddSingleQuestionToBank = async (index: number) => {
    const q = analyzedQuestions[index];
    if (!q) return;
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          text: q.text,
          options: q.options,
          correctAnswerId: q.correctAnswerId,
          explanation: q.explanation,
          subject: q.subject,
          topic: q.topic,
          difficulty: q.difficulty,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          questionSource: q.questionSource
        })
      });
      if (res.ok) {
        setAnalyzedQuestions(prev => prev.filter((_, i) => i !== index));
        refreshAllData();
        alert('Question successfully saved into Question Bank!');
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save question'}`);
      }
    } catch (e: any) {
      alert(`Failed to save question: ${e.message}`);
    }
  };

  // Bulk Add All Analyzed Questions to Bank
  const handleAddAllAnalyzedToBank = async () => {
    if (!analyzedQuestions.length) return;
    try {
      const res = await fetch('/api/questions/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ questions: analyzedQuestions })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully imported all ${data.count || analyzedQuestions.length} questions into Question Bank!`);
        setAnalyzedQuestions([]);
        refreshAllData();
        setActiveTab('questions');
      } else {
        alert(data.error || 'Failed to import questions');
      }
    } catch (e: any) {
      alert(`Failed to import questions: ${e.message}`);
    }
  };

  // Admin Change Password Handler
  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPasswordStatus(null);

    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      setAdminPasswordStatus({ type: 'error', message: 'New password and confirm password do not match.' });
      return;
    }

    if (adminPasswordForm.newPassword.length < 6) {
      setAdminPasswordStatus({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }

    setAdminPasswordLoading(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          currentPassword: adminPasswordForm.currentPassword,
          newPassword: adminPasswordForm.newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update administrator password');

      setAdminPasswordStatus({ type: 'success', message: 'Administrator master password changed successfully!' });
      setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setIsAdminPasswordModalOpen(false);
        setAdminPasswordStatus(null);
      }, 1600);
    } catch (err: any) {
      setAdminPasswordStatus({ type: 'error', message: err.message || 'Error updating password' });
    } finally {
      setAdminPasswordLoading(false);
    }
  };

  // Save Exam
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(newExamData)
      });
      if (res.ok) {
        setExamModalOpen(false);
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Doubt Reply
  const handleSendDoubtReply = async () => {
    if (!replyingDoubt || !doubtReplyText.trim()) return;
    try {
      const res = await fetch(`/api/doubts/${replyingDoubt.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ adminReply: doubtReplyText.trim(), status: 'Answered' })
      });
      if (res.ok) {
        setReplyingDoubt(null);
        setDoubtReplyText('');
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Publish Announcement
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.message) return;
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ ...newAnnouncement })
      });
      if (res.ok) {
        setNewAnnouncement({ title: '', message: '', priority: 'medium' });
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Update Settings
  const handleSaveSettings = async (updated: Partial<PlatformSettings>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        alert('Settings updated successfully!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Sleek Minimalist Admin Navigation Strip - No Logo, No Name, No Bulky Headbar Panel */}
      <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-2 flex items-center justify-between shadow-sm overflow-x-auto">
        {/* Admin Navigation Tabs */}
        <nav className="flex items-center gap-1.5 min-w-max text-xs">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'approvals', label: 'Student Approvals', icon: Users, badge: overview?.metrics?.pendingApprovals },
            { id: 'questions', label: 'Question Bank', icon: BookOpen },
            { id: 'ai-generator', label: 'AI Generator', icon: Sparkles },
            { id: 'ocr-import', label: 'AI Import (ChatGPT / PDF)', icon: FileUp },
            { id: 'exams', label: 'Examinations', icon: FileText },
            { id: 'doubts', label: 'Academic Doubts', icon: MessageSquare, badge: overview?.metrics?.pendingDoubts },
            { id: 'announcements', label: 'Announcements', icon: AlertTriangle },
            { id: 'settings', label: 'Settings & Security', icon: Settings },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="ml-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Right Tools: Theme Switcher, Password, Sync, Lock & Exit */}
        <div className="flex items-center gap-2 sm:gap-3 pl-4 shrink-0">
          <ThemeSwitcher />
          <button
            onClick={() => {
              setAdminPasswordStatus(null);
              setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
              setIsAdminPasswordModalOpen(true);
            }}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-xs flex items-center gap-1 transition-colors"
            title="Change Administrator Password"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Password</span>
          </button>
          <button
            onClick={refreshAllData}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-xs flex items-center gap-1 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Sync</span>
          </button>
          <button
            onClick={logoutAdmin}
            className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && overview && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Total Enrolled</span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
                  {overview.metrics.totalStudents}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Approved: <span className="text-emerald-400 font-mono">{overview.metrics.approvedStudents}</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <span className="text-[11px] uppercase tracking-wider text-amber-400 block mb-1">Pending Approvals</span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400">
                  {overview.metrics.pendingApprovals}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Action required</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Total Tests</span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-400">
                  {overview.metrics.totalExams}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Online: {overview.metrics.onlineExams} · Offline: {overview.metrics.offlineExams}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block mb-1">Average Batch Score</span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400">
                  {overview.metrics.avgPercentage}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Total Submissions: <span className="font-mono">{overview.metrics.totalAttempts}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Batch Performance Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Batch Competitive Benchmark</span>
                  <span className="text-xs text-slate-400 font-normal">Ranked by Avg Score</span>
                </h3>
                <div className="space-y-3">
                  {overview.batchAnalytics?.map((b: any) => (
                    <div key={b.batchId} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{b.batchName}</span>
                        <span className="font-mono text-indigo-400 font-bold">{b.averagePercentage}% Avg</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${b.averagePercentage}%` }} />
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>Students: {b.studentCount}</span>
                        <span>Attempts: {b.attemptsCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hardest Questions Identification */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center justify-between">
                  <span>Difficult Topics & Question Analytics</span>
                  <span className="text-xs text-red-400 font-normal">High Failure Rates</span>
                </h3>
                <div className="space-y-3">
                  {overview.questionAnalytics?.slice(0, 4).map((q: any) => (
                    <div key={q.questionId} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{q.subject} · {q.topic}</span>
                        <span className="text-red-400 font-mono font-bold">{q.failureRate}% Failed</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{q.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDENT REGISTRATION & APPROVAL PANEL */}
        {activeTab === 'approvals' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                {['Pending', 'Approved', 'Suspended', 'all'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStudentStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      studentStatusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'All Students' : `${st} (${students.filter(s => st === 'all' || s.status === st).length})`}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, ID, email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 border-b border-slate-800 uppercase text-[10px] text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-3.5">Student Details</th>
                      <th className="p-3.5">Roll / Reg No.</th>
                      <th className="p-3.5">Batch</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Registered</th>
                      <th className="p-3.5 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {students
                      .filter(s => (studentStatusFilter === 'all' ? true : s.status === studentStatusFilter))
                      .filter(s => !studentSearch || s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || s.registrationNumber.toLowerCase().includes(studentSearch.toLowerCase()))
                      .length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-slate-400 text-xs">
                            <div className="space-y-2">
                              <Users className="w-7 h-7 text-slate-600 mx-auto" />
                              <p className="font-semibold text-slate-300">No student accounts found</p>
                              <p className="text-slate-500 text-[11px]">When candidates register on the portal, their accounts will appear here for management.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        students
                          .filter(s => (studentStatusFilter === 'all' ? true : s.status === studentStatusFilter))
                          .filter(s => !studentSearch || s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || s.registrationNumber.toLowerCase().includes(studentSearch.toLowerCase()))
                          .map(st => (
                            <tr key={st.id} className="hover:bg-slate-950/40 transition-colors">
                              <td className="p-3.5">
                                <div className="font-semibold text-white">{st.fullName}</div>
                                <div className="text-[11px] text-slate-400">{st.email} · {st.mobile}</div>
                              </td>
                              <td className="p-3.5 font-mono text-slate-300">{st.registrationNumber}</td>
                              <td className="p-3.5 text-indigo-400">{batches.find(b => b.id === st.batchId)?.name || 'General'}</td>
                              <td className="p-3.5">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    st.status === 'Approved'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : st.status === 'Pending'
                                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                      : st.status === 'Rejected'
                                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                      : 'bg-red-950 text-red-400 border border-red-800'
                                  }`}
                                  title={st.rejectionReason}
                                >
                                  {st.status}
                                </span>
                                {st.rejectionReason && (
                                  <div className="text-[10px] text-rose-400/80 truncate max-w-[150px] mt-0.5" title={st.rejectionReason}>
                                    {st.rejectionReason}
                                  </div>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-400 text-[11px] font-mono">
                                {new Date(st.createdAt).toLocaleDateString()}
                              </td>
                              <td className="p-3.5 text-right space-x-1.5">
                                {st.status === 'Pending' && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateStudentStatus(st.id, 'Approved')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectModalStudent({ id: st.id, fullName: st.fullName });
                                        setRejectionReason('Application does not meet enrollment criteria');
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {st.status === 'Rejected' && (
                                  <button
                                    onClick={() => handleUpdateStudentStatus(st.id, 'Approved')}
                                    className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded-lg text-[11px] transition-colors"
                                    title="Re-approve candidate"
                                  >
                                    Re-approve
                                  </button>
                                )}

                                {st.status === 'Approved' && (
                                  <button
                                    onClick={() => handleUpdateStudentStatus(st.id, 'Suspended')}
                                    className="px-2 py-1 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg text-[11px] transition-colors"
                                  >
                                    Suspend
                                  </button>
                                )}

                                {st.status === 'Suspended' && (
                                  <button
                                    onClick={() => handleUpdateStudentStatus(st.id, 'Approved')}
                                    className="px-2 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-lg text-[11px] transition-colors"
                                  >
                                    Reactivate
                                  </button>
                                )}

                                <button
                                  onClick={() => handleViewStudentHistory(st.id)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                                  title="Full Performance History"
                                >
                                  Profile
                                </button>

                                <button
                                  onClick={() => handleResetPassword(st.id)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                                  title="Reset Password"
                                >
                                  Reset Pass
                                </button>

                                <button
                                  onClick={() => setStudentToDelete({ id: st.id, fullName: st.fullName, regNo: st.registrationNumber })}
                                  className="px-2 py-1 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-lg text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                                  title="Permanently Delete Student Account"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-400" />
                                  <span>Delete</span>
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Full History Modal */}
            {selectedStudentForHistory && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-white">
                      Candidate Profile & Full Test History: {selectedStudentForHistory.student.fullName}
                    </h3>
                    <button onClick={() => setSelectedStudentForHistory(null)} className="text-slate-400 hover:text-white">
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div>Email: <strong className="text-white">{selectedStudentForHistory.student.email}</strong></div>
                    <div>Mobile: <strong className="text-white">{selectedStudentForHistory.student.mobile}</strong></div>
                    <div>Registration No: <strong className="text-indigo-400 font-mono">{selectedStudentForHistory.student.registrationNumber}</strong></div>
                    <div>Account Status: <strong className="text-emerald-400">{selectedStudentForHistory.student.status}</strong></div>
                  </div>

                  <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Exam Attempts ({selectedStudentForHistory.attempts?.length || 0})</h4>
                  <div className="space-y-2">
                    {selectedStudentForHistory.attempts?.map((a: any) => (
                      <div key={a.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-white block">{a.examName}</span>
                          <span className="text-[11px] text-slate-400">{new Date(a.submittedTime || a.startTime).toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-emerald-400 font-bold block">{a.score} Marks ({a.percentage}%)</span>
                          <span className="text-[10px] text-slate-500">Accuracy: {a.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const st = selectedStudentForHistory.student;
                        setStudentToDelete({ id: st.id, fullName: st.fullName, regNo: st.registrationNumber });
                      }}
                      className="px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Student Account
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedStudentForHistory(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CENTRALIZED QUESTION BANK */}
        {activeTab === 'questions' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Top Toolbar: Filter, Search, and Add Question Button */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddQuestion}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question to Bank</span>
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                <div className="hidden lg:flex items-center gap-1 text-xs">
                  {['all', 'Math', 'Reasoning', 'GK', 'Current Affairs', 'English', 'Computer'].map(sub => (
                    <button
                      key={sub}
                      onClick={() => setQuestionSubjectFilter(sub)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        questionSubjectFilter === sub
                          ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search question statement..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* QUESTION ADDING & EDITING PANEL */}
            {showQuestionForm && (
              <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">
                      {questionFormData.id ? 'Edit Question' : 'Add New Question to Question Bank'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure problem statement, options (2–6), correct answer choice, scoring, and step-by-step solution.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowQuestionForm(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveQuestion} className="space-y-4">
                  {/* Subject, Topic, Difficulty, Marks */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Subject *</label>
                      <select
                        value={questionFormData.subject}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, subject: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                      >
                        <option value="Math">Math</option>
                        <option value="Reasoning">Reasoning</option>
                        <option value="GK">GK</option>
                        <option value="Current Affairs">Current Affairs</option>
                        <option value="English">English</option>
                        <option value="Computer">Computer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Topic *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mechanics, Optics, Calculus"
                        value={questionFormData.topic}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, topic: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Difficulty</label>
                      <select
                        value={questionFormData.difficulty}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, difficulty: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard / Advanced</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Marks (+)</label>
                        <input
                          type="number"
                          value={questionFormData.marks}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, marks: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">Negative (-)</label>
                        <input
                          type="number"
                          value={questionFormData.negativeMarks}
                          onChange={(e) => setQuestionFormData({ ...questionFormData, negativeMarks: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-2.5 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Question Statement */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Question Statement *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Enter question statement here. Formulas, symbols (√, ∫, π, θ, λ, Δ) and equations are fully supported..."
                      value={questionFormData.text}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, text: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white leading-relaxed"
                    />
                  </div>

                  {/* Optional Diagram / Image */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Optional Diagram / Image (URL or Upload File)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://... or upload image"
                        value={questionFormData.imageUrl}
                        onChange={(e) => setQuestionFormData({ ...questionFormData, imageUrl: e.target.value })}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                      />
                      <label className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const r = new FileReader();
                              r.onload = () => setQuestionFormData({ ...questionFormData, imageUrl: r.result as string });
                              r.readAsDataURL(f);
                            }
                          }}
                        />
                      </label>
                    </div>
                    {questionFormData.imageUrl && (
                      <div className="mt-2 p-2 bg-slate-950 border border-slate-800 rounded-xl inline-block">
                        <img src={questionFormData.imageUrl} alt="Preview" className="max-h-32 rounded object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Option Count Selector (2 to 6 options) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs font-semibold text-white">Answer Options ({questionFormData.options.length} options)</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>Total Options:</span>
                      {[2, 3, 4, 5, 6].map(count => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => {
                            let opts = [...questionFormData.options];
                            if (count > opts.length) {
                              for (let i = opts.length; i < count; i++) {
                                opts.push({ id: `opt_${i + 1}`, text: '' });
                              }
                            } else if (count < opts.length) {
                              opts = opts.slice(0, count);
                            }
                            let correct = questionFormData.correctAnswerId;
                            if (!opts.find(o => o.id === correct)) {
                              correct = opts[0]?.id || 'opt_1';
                            }
                            setQuestionFormData({
                              ...questionFormData,
                              optionCount: count,
                              options: opts,
                              correctAnswerId: correct
                            });
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                            questionFormData.options.length === count
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Options List with Radio button to mark correct answer */}
                  <div className="space-y-2.5">
                    {questionFormData.options.map((opt, oIdx) => {
                      const letter = ['A', 'B', 'C', 'D', 'E', 'F'][oIdx] || `${oIdx + 1}`;
                      const isCorrect = opt.id === questionFormData.correctAnswerId;

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-950/30 border-emerald-600'
                              : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer shrink-0" title="Mark as correct answer">
                            <input
                              type="radio"
                              name="correctAnswerOption"
                              checked={isCorrect}
                              onChange={() => setQuestionFormData({ ...questionFormData, correctAnswerId: opt.id })}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                            />
                            <span className={`font-mono font-bold text-xs ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}`}>
                              Option {letter}
                            </span>
                          </label>

                          <input
                            type="text"
                            required
                            placeholder={`Enter text for Option ${letter}...`}
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...questionFormData.options];
                              updated[oIdx].text = e.target.value;
                              setQuestionFormData({ ...questionFormData, options: updated });
                            }}
                            className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-0"
                          />

                          {isCorrect && (
                            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800 shrink-0">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed Step-by-Step Explanation */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Step-by-Step Scientific Solution & Faculty Explanation
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain derivation, concepts, shortcut formulas, and why other options are distractors..."
                      value={questionFormData.explanation}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, explanation: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white leading-relaxed"
                    />
                  </div>

                  {/* Question Source */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Source / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SSC CGL 2024 / Banking PO / Railway NTPC / OSSC Question Bank"
                      value={questionFormData.questionSource}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, questionSource: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowQuestionForm(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={questionFormSubmitting}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {questionFormSubmitting ? 'Saving Question...' : (questionFormData.id ? 'Update Question' : 'Save Question to Bank')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3">
              {questions
                .filter(q => questionSubjectFilter === 'all' || q.subject.toLowerCase() === questionSubjectFilter.toLowerCase())
                .filter(q => !questionSearch || q.text.toLowerCase().includes(questionSearch.toLowerCase()))
                .map((q, idx) => (
                  <div key={q.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono">#{idx + 1}</span>
                        <span className="text-indigo-400 font-semibold">{q.subject}</span>
                        <span>·</span>
                        <span>{q.topic}</span>
                        <span>·</span>
                        <span className="text-slate-500">{q.difficulty}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-emerald-400 text-xs">
                          +{q.marks} / -{q.negativeMarks} Marks
                        </span>
                        <button
                          onClick={() => handleEditQuestion(q)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                          title="Edit Question"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-200 font-medium whitespace-pre-wrap">{q.text}</div>

                    {q.imageUrl && (
                      <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl inline-block max-w-xs">
                        <img src={q.imageUrl} alt="Diagram" className="max-h-36 object-contain rounded" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const letter = ['A', 'B', 'C', 'D', 'E', 'F'][oIdx] || `${oIdx + 1}`;
                        const isCorrect = opt.id === q.correctAnswerId;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span><strong className="font-mono mr-1.5">{letter}.</strong> {opt.text}</span>
                            {isCorrect && <span className="text-[10px] text-emerald-400 font-bold uppercase">Correct</span>}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <strong className="text-slate-300">Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 4: AI QUESTION GENERATOR */}
        {activeTab === 'ai-generator' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* AI Engine Status & Diagnostics Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500 relative" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">AI Integration Status:</span>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                      Fully Integrated & Connected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Server-Side Gemini SDK (<code className="text-indigo-300">@google/genai</code>) · Active Engine: <strong className="text-white">{aiGenForm.aiModel}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={checkAiHealth}
                disabled={aiStatusChecking}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 border border-slate-700 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiStatusChecking ? 'animate-spin' : ''}`} />
                <span>{aiStatusChecking ? 'Pinging AI Engine...' : 'Test AI Connection'}</span>
              </button>
            </div>

            {aiStatus && (
              <div className="p-3 bg-indigo-950/30 border border-indigo-800/50 rounded-xl text-xs text-indigo-200 flex items-center justify-between">
                <span>{aiStatus.message || 'AI Engine is ready.'}</span>
                <span className="text-[11px] text-slate-400 font-mono">Provider: {aiStatus.provider}</span>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">AI Competitive Question Generator</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate questions with step-by-step scientific derivations and answer choices. Questions enter a <strong>Draft / Review</strong> state so the administrator can verify them before approving into the live Question Bank.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3 bg-indigo-950/30 border border-indigo-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">AI Model Engine</span>
                      <span className="text-[11px] text-slate-400">Select model engine for competitive question generation</span>
                    </div>
                  </div>
                  <select
                    value={aiGenForm.aiModel}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, aiModel: e.target.value })}
                    className="bg-slate-900 border border-indigo-700/80 rounded-xl py-2 px-3 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
                  >
                    <option value="gemini-flash-latest">Google Gemini Flash Latest (Recommended · Fast & Resilient)</option>
                    <option value="gemini-3.1-flash-lite">Google Gemini 3.1 Flash Lite (High-Speed Engine)</option>
                    <option value="gemini-3.8-flash">Google Gemini 3.8 Flash (Comprehensive STEM Engine)</option>
                    <option value="chatgpt-4o">ChatGPT-4o (Reasoning & MCQ Engine)</option>
                    <option value="chatgpt-o1">ChatGPT o1 (STEM High-Reasoning Multi-Step)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Subject *</label>
                  <select
                    value={aiGenForm.subject}
                    onChange={(e) => {
                      const newSub = e.target.value;
                      const defaultTop = SUBJECT_TOPIC_PRESETS[newSub]?.[0] || 'Core Concept';
                      setAiGenForm({ ...aiGenForm, subject: newSub, topic: defaultTop });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="Math">Math</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="GK">GK</option>
                    <option value="Current Affairs">Current Affairs</option>
                    <option value="English">English</option>
                    <option value="Computer">Computer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Target Exam Type *</label>
                  <select
                    value={aiGenForm.examType}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, examType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="Banking">Banking (IBPS PO/Clerk, SBI PO/Clerk, RBI)</option>
                    <option value="Railway">Railway (RRB NTPC, Group D, ALP)</option>
                    <option value="SSC">SSC (CGL, CHSL, MTS, CPO, GD)</option>
                    <option value="OSSC">OSSC (Odisha SSC CGL, Auditor)</option>
                    <option value="OSSSSC">OSSSSC (Odisha SSSC RI, ARI, Amin, JA)</option>
                    <option value="ALL">ALL (Combined Competitive Exam)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={aiGenForm.difficulty}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, difficulty: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="Easy">Easy (Foundation / Speed Practice)</option>
                    <option value="Medium">Medium (Standard Exam Benchmark)</option>
                    <option value="Hard">Hard / Advanced (Tier-II / Mains Level)</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase text-slate-400">Topic *</label>
                    <span className="text-[11px] text-slate-500">Click a preset below or type custom topic</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={aiGenForm.topic}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, topic: e.target.value })}
                    placeholder="e.g. Arithmetic & Simplification"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                  {/* Topic Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(SUBJECT_TOPIC_PRESETS[aiGenForm.subject] || []).map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAiGenForm({ ...aiGenForm, topic: preset })}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                          aiGenForm.topic === preset
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Options Per Question</label>
                  <select
                    value={aiGenForm.optionCount}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, optionCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value={2}>2 Options (True/False)</option>
                    <option value={4}>4 Options (Standard Banking / SSC)</option>
                    <option value={5}>5 Options (Standard Bank PO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Number of Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={aiGenForm.count}
                    onChange={(e) => setAiGenForm({ ...aiGenForm, count: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={handleRunAiGeneration}
                  disabled={aiGenerating}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${aiGenerating ? 'animate-spin' : ''}`} />
                  {aiGenerating ? 'AI Generating Draft Questions with Gemini...' : 'Generate Questions with AI'}
                </button>
                {aiDraftQuestions.length > 0 && (
                  <button
                    onClick={() => setAiDraftQuestions([])}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                  >
                    Clear Drafts
                  </button>
                )}
              </div>
            </div>

            {/* AI Draft Questions Review Table */}
            {aiDraftQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="bg-emerald-950/30 border border-emerald-800/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Draft Review: {aiDraftQuestions.length} Questions Generated
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Questions have been verified. Click approve to commit all questions directly into the Centralized Question Bank.
                    </p>
                  </div>
                  <button
                    onClick={handleApproveAiQuestions}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Save All to Question Bank
                  </button>
                </div>

                <div className="space-y-3">
                  {aiDraftQuestions.map((q, idx) => (
                    <div key={idx} className="bg-slate-900 border border-amber-800/40 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-400">Draft Question #{idx + 1}</span>
                        <span className="text-slate-400">{q.subject} · {q.topic}</span>
                      </div>
                      <p className="text-sm text-white font-medium">{q.text}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {q.options?.map((opt: any, oIdx: number) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-xl border ${
                              opt.isCorrect || opt.id === q.correctAnswerId
                                ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {opt.text}
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <strong>Derivation:</strong> {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: AI QUESTION IMPORTER (CHATGPT TEXT & PDF / DOCUMENT) */}
        {activeTab === 'ocr-import' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">AI Question Importer</h3>
                    <p className="text-xs text-slate-400">Import questions from ChatGPT prompts or PDF & document files</p>
                  </div>
                </div>

                {/* Import Mode Switcher: ChatGPT Text vs PDF Upload */}
                <div className="inline-flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportMode('text')}
                    className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
                      importMode === 'text'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>ChatGPT / Text Prompt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('file')}
                    className={`px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-colors ${
                      importMode === 'file'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    <span>PDF & Document Upload</span>
                  </button>
                </div>
              </div>

              {/* Source Input Area */}
              {importMode === 'text' ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold uppercase text-slate-300">
                      Paste ChatGPT Generated Questions or Raw Exam Text
                    </label>
                    <span className="text-[11px] text-slate-500">Supports standard text, markdown, numbered MCQs</span>
                  </div>
                  <textarea
                    rows={8}
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    placeholder={`Paste questions generated by ChatGPT or any text document. For example:

1. A block of mass 2 kg is placed on a rough horizontal surface with friction coefficient 0.4. If a force of 10 N is applied horizontally, the acceleration of the block is:
(A) 1.08 m/s²
(B) 2.5 m/s²
(C) 0.5 m/s²
(D) 0 m/s²
Correct: (A)
Explanation: Limiting friction f_max = μmg = 0.4 × 2 × 9.8 = 7.84 N. Net force = 10 - 7.84 = 2.16 N. Acceleration = F_net / m = 2.16 / 2 = 1.08 m/s².`}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase text-slate-300">
                      Upload Question Paper Document (PDF, PNG, JPG)
                    </label>
                    <span className="text-[11px] text-slate-500">Document Understanding Vision OCR</span>
                  </div>

                  <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-3xl p-6 text-center bg-slate-950/60 transition-colors">
                    <FileUp className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-medium mb-1">
                      Choose a PDF question paper or scanned page image
                    </p>
                    <p className="text-[11px] text-slate-500 mb-4">Supported formats: .pdf, .png, .jpg, .jpeg, .webp (up to 50MB)</p>

                    <input
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setImportFileName(file.name);
                        setImportFileMime(file.type || 'application/pdf');
                        const reader = new FileReader();
                        reader.onload = () => {
                          setImportFileBase64(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="inline-block text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                    />

                    {importFileName && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-950/60 border border-indigo-800 rounded-xl text-xs text-indigo-300">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="font-semibold">{importFileName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setImportFileBase64(null);
                            setImportFileName('');
                          }}
                          className="text-slate-400 hover:text-white ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Configuration Settings Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Subject</label>
                  <select
                    value={importSubject}
                    onChange={(e) => setImportSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="Math">Math</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="GK">GK</option>
                    <option value="Current Affairs">Current Affairs</option>
                    <option value="English">English</option>
                    <option value="Computer">Computer</option>
                    <option value="ALL">ALL (Comprehensive Combined)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Default Topic</label>
                  <input
                    type="text"
                    value={importTopic}
                    onChange={(e) => setImportTopic(e.target.value)}
                    placeholder="e.g. Mechanics, Optics"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Difficulty</label>
                  <select
                    value={importDifficulty}
                    onChange={(e) => setImportDifficulty(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Marks / Negative</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={importMarks}
                      onChange={(e) => setImportMarks(Number(e.target.value))}
                      className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs text-white text-center"
                      title="Marks"
                    />
                    <input
                      type="number"
                      value={importNegativeMarks}
                      onChange={(e) => setImportNegativeMarks(Number(e.target.value))}
                      className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl py-2 px-2 text-xs text-rose-300 text-center"
                      title="Negative Deduction"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">AI Reasoning Engine</label>
                  <select
                    value={importAiModel}
                    onChange={(e) => setImportAiModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  >
                    <option value="gemini-flash-latest">Google Gemini Flash (Recommended)</option>
                    <option value="gemini-3.1-flash-lite">Google Gemini 3.1 Flash Lite</option>
                    <option value="gemini-3.8-flash">Google Gemini 3.8 Flash</option>
                    <option value="chatgpt-4o">ChatGPT-4o</option>
                    <option value="chatgpt-o1">ChatGPT o1</option>
                  </select>
                </div>
              </div>

              {/* Action Trigger */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzingImport}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-900/40 transition-colors"
                >
                  <Sparkles className={`w-4 h-4 ${isAnalyzingImport ? 'animate-spin' : ''}`} />
                  {isAnalyzingImport
                    ? 'AI is Analyzing Questions, Extracting Options & Derivations...'
                    : 'Analyze & Extract Questions with AI'}
                </button>

                {analyzedQuestions.length > 0 && (
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {analyzedQuestions.length} Questions Ready for Review Below
                  </span>
                )}
              </div>
            </div>

            {/* ANALYZED QUESTIONS REVIEW & EDIT SCREEN */}
            {analyzedQuestions.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-base text-white flex items-center gap-2">
                      <span>Analyzed Questions Review</span>
                      <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full text-xs font-mono">
                        {analyzedQuestions.length}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review and edit question statements, options, or derivations below before adding them to the Question Bank.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Discard all analyzed questions?')) {
                          setAnalyzedQuestions([]);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3.5 py-2 rounded-xl text-xs transition-colors"
                    >
                      Discard All
                    </button>

                    <button
                      type="button"
                      onClick={handleAddAllAnalyzedToBank}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Add All ({analyzedQuestions.length}) to Question Bank
                    </button>
                  </div>
                </div>

                {/* Editable Question Cards */}
                <div className="space-y-4">
                  {analyzedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-md space-y-4 transition-colors"
                    >
                      {/* Question Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-xl">
                            Question #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={q.subject}
                            onChange={(e) => {
                              const updated = [...analyzedQuestions];
                              updated[idx].subject = e.target.value;
                              setAnalyzedQuestions(updated);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-indigo-300 font-semibold"
                            placeholder="Subject"
                          />
                          <input
                            type="text"
                            value={q.topic}
                            onChange={(e) => {
                              const updated = [...analyzedQuestions];
                              updated[idx].topic = e.target.value;
                              setAnalyzedQuestions(updated);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2.5 text-xs text-slate-300"
                            placeholder="Topic / Chapter"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={q.difficulty}
                            onChange={(e) => {
                              const updated = [...analyzedQuestions];
                              updated[idx].difficulty = e.target.value as any;
                              setAnalyzedQuestions(updated);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-lg py-1 px-2 text-xs text-slate-300"
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>

                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span className="text-slate-500">Marks:</span>
                            <input
                              type="number"
                              value={q.marks}
                              onChange={(e) => {
                                const updated = [...analyzedQuestions];
                                updated[idx].marks = Number(e.target.value);
                                setAnalyzedQuestions(updated);
                              }}
                              className="w-12 bg-slate-950 border border-slate-800 rounded-lg py-0.5 px-1.5 text-xs text-white text-center"
                            />
                            <span className="text-slate-500 ml-1">Neg:</span>
                            <input
                              type="number"
                              value={q.negativeMarks}
                              onChange={(e) => {
                                const updated = [...analyzedQuestions];
                                updated[idx].negativeMarks = Number(e.target.value);
                                setAnalyzedQuestions(updated);
                              }}
                              className="w-12 bg-slate-950 border border-slate-800 rounded-lg py-0.5 px-1.5 text-xs text-rose-300 text-center"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setAnalyzedQuestions(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors ml-1"
                            title="Discard question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question Statement (Editable) */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                          Question Statement (Editable)
                        </label>
                        <textarea
                          rows={3}
                          value={q.text}
                          onChange={(e) => {
                            const updated = [...analyzedQuestions];
                            updated[idx].text = e.target.value;
                            setAnalyzedQuestions(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 leading-relaxed"
                        />
                      </div>

                      {/* Options (Editable with Correct Answer Toggle) */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold uppercase text-slate-400">
                            Multiple Choice Options (Select Radio Button for Correct Answer)
                          </label>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            Green border indicates verified correct choice
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options?.map((opt: any, optIdx: number) => {
                            const isCorrect = opt.id === q.correctAnswerId || opt.isCorrect;
                            const optionLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || `${optIdx + 1}`;
                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                                  isCorrect
                                    ? 'bg-emerald-950/30 border-emerald-600/80 shadow-sm'
                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...analyzedQuestions];
                                    updated[idx].correctAnswerId = opt.id;
                                    updated[idx].options.forEach((o: any) => {
                                      o.isCorrect = o.id === opt.id;
                                    });
                                    setAnalyzedQuestions(updated);
                                  }}
                                  className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                  }`}
                                  title="Mark as correct answer"
                                >
                                  {optionLetter}
                                </button>

                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const updated = [...analyzedQuestions];
                                    updated[idx].options[optIdx].text = e.target.value;
                                    setAnalyzedQuestions(updated);
                                  }}
                                  className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none"
                                  placeholder={`Option ${optionLetter}`}
                                />

                                {isCorrect && (
                                  <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 bg-emerald-950/60 rounded border border-emerald-800 shrink-0">
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanation / Derivation (Editable) */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
                          Step-by-Step Derivation & Explanation (Editable)
                        </label>
                        <textarea
                          rows={2}
                          value={q.explanation}
                          onChange={(e) => {
                            const updated = [...analyzedQuestions];
                            updated[idx].explanation = e.target.value;
                            setAnalyzedQuestions(updated);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleAddSingleQuestionToBank(idx)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add This Question to Question Bank
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: EXAMINATIONS MANAGEMENT */}
        {activeTab === 'exams' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Configured Examinations ({exams.length})</h3>
              <button
                onClick={() => setExamModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Schedule New Examination
              </button>
            </div>

            {exams.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center mx-auto text-indigo-400">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">No Examinations Configured</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    The examination portal is clean and ready. Schedule an online or offline test by selecting questions from the Question Bank or importing them via AI/PDF.
                  </p>
                </div>
                <button
                  onClick={() => setExamModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Schedule New Examination
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map(exam => (
                  <div key={exam.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-indigo-400 font-semibold">{exam.mode.toUpperCase()}</span>
                        <span className="text-emerald-400 font-semibold">{exam.status}</span>
                      </div>
                      <h4 className="text-base font-bold text-white">{exam.name}</h4>
                      <p className="text-xs text-slate-400">{exam.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        <span>Duration: <strong className="text-white">{exam.durationMinutes}m</strong></span>
                        <span>·</span>
                        <span>Total Marks: <strong className="text-white">{exam.totalMarks}</strong></span>
                        <span>·</span>
                        <span>Questions: <strong className="text-white">{exam.questionCount || exam.questionIds.length}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => onPreviewExam(exam.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Preview candidate examination view"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview Exam
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Delete examination ${exam.name}?`)) {
                            await fetch(`/api/exams/${exam.id}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${adminToken}` }
                            });
                            refreshAllData();
                          }
                        }}
                        className="text-red-400 hover:text-red-300 p-1.5 rounded-lg"
                        title="Delete Examination"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Exam Modal */}
            {examModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-base text-white">Create & Schedule Examination</h3>
                    <button onClick={() => setExamModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <form onSubmit={handleSaveExam} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Exam Title *</label>
                      <input
                        type="text"
                        required
                        value={newExamData.name}
                        onChange={(e) => setNewExamData({ ...newExamData, name: e.target.value })}
                        placeholder="e.g. All-India Grand Mock Test 02"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Target Batch / Class *</label>
                        <select
                          value={newExamData.batchIds?.[0] || 'all'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewExamData({
                              ...newExamData,
                              targetBatch: val === 'all' ? 'ALL' : batches.find(b => b.id === val)?.name || val,
                              batchIds: val === 'all' ? ['all'] : [val]
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        >
                          <option value="all">ALL (Common To All Batches)</option>
                          {batches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.targetExam})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Subject Paper *</label>
                        <select
                          value={newExamData.subject}
                          onChange={(e) => setNewExamData({ ...newExamData, subject: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        >
                          <option value="ALL">ALL (Combined Comprehensive Mock)</option>
                          <option value="Math">Math</option>
                          <option value="Reasoning">Reasoning</option>
                          <option value="GK">GK</option>
                          <option value="Current Affairs">Current Affairs</option>
                          <option value="English">English</option>
                          <option value="Computer">Computer</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Mode</label>
                        <select
                          value={newExamData.mode}
                          onChange={(e) => setNewExamData({ ...newExamData, mode: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        >
                          <option value="online">Online Mode (Browser Testing)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Duration (Minutes)</label>
                        <input
                          type="number"
                          value={newExamData.durationMinutes}
                          onChange={(e) => setNewExamData({ ...newExamData, durationMinutes: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Marks Per Question</label>
                        <input
                          type="number"
                          value={newExamData.marksPerQuestion}
                          onChange={(e) => setNewExamData({ ...newExamData, marksPerQuestion: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Negative Deduction</label>
                        <input
                          type="number"
                          value={newExamData.negativeMarksPerQuestion}
                          onChange={(e) => setNewExamData({ ...newExamData, negativeMarksPerQuestion: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold uppercase text-slate-400">
                          Select Questions from Bank ({newExamData.questionIds?.length || 0} Selected)
                        </label>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Total Marks: {(newExamData.questionIds?.length || 0) * (Number(newExamData.marksPerQuestion) || 4)}
                        </span>
                      </div>

                      {/* Subject Filter Pills for Question Selection */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {['all', 'Math', 'Reasoning', 'GK', 'Current Affairs', 'English', 'Computer'].map(sub => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setExamQuestionSubjectFilter(sub)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors ${
                              examQuestionSubjectFilter === sub
                                ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>

                      <div className="max-h-48 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        {questions
                          .filter(q => examQuestionSubjectFilter === 'all' || q.subject.toLowerCase() === examQuestionSubjectFilter.toLowerCase())
                          .map(q => {
                            const isSel = newExamData.questionIds?.includes(q.id);
                            return (
                              <label key={q.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={(e) => {
                                    const ids = newExamData.questionIds || [];
                                    if (e.target.checked) {
                                      setNewExamData({ ...newExamData, questionIds: [...ids, q.id] });
                                    } else {
                                      setNewExamData({ ...newExamData, questionIds: ids.filter((x: string) => x !== q.id) });
                                    }
                                  }}
                                />
                                <span className="font-semibold text-indigo-400 shrink-0">[{q.subject}]</span>
                                <span className="truncate">{q.text}</span>
                              </label>
                            );
                          })}
                        {questions.filter(q => examQuestionSubjectFilter === 'all' || q.subject.toLowerCase() === examQuestionSubjectFilter.toLowerCase()).length === 0 && (
                          <div className="text-center py-4 text-xs text-slate-500">
                            No questions found in {examQuestionSubjectFilter}. Generate or add questions to the Bank first.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setExamModalOpen(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-xs shadow-md"
                      >
                        Schedule Examination
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: STUDENT ACADEMIC DOUBTS */}
        {activeTab === 'doubts' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <h3 className="font-bold text-base text-white">Student Academic Doubts ({doubts.length})</h3>

            <div className="space-y-3">
              {doubts.map(d => (
                <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{d.studentName}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-indigo-400 font-mono">{d.subject}</span>
                    </div>
                    <span className="text-amber-400 font-medium">{d.status}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{d.title}</h4>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">{d.question}</p>

                  {d.adminReply ? (
                    <div className="p-3 bg-slate-950 border border-emerald-900/40 rounded-xl text-xs space-y-1">
                      <span className="text-emerald-400 font-semibold block">Your Answer:</span>
                      <p className="text-slate-300">{d.adminReply}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingDoubt(d);
                        setDoubtReplyText('');
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Reply to Doubt
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Reply Modal */}
            {replyingDoubt && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                  <h3 className="font-bold text-white text-sm">Reply to {replyingDoubt.studentName}</h3>
                  <textarea
                    rows={4}
                    value={doubtReplyText}
                    onChange={(e) => setDoubtReplyText(e.target.value)}
                    placeholder="Enter mathematical derivation or solution instructions..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReplyingDoubt(null)}
                      className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendDoubtReply}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-xl text-xs"
                    >
                      Send Answer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 9: ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white">Publish Platform Announcement</h3>
              <form onSubmit={handlePublishAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Message</label>
                  <textarea
                    rows={3}
                    required
                    value={newAnnouncement.message}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-xl text-xs shadow-md"
                >
                  Publish Announcement
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 9: SETTINGS, SECURITY, SHORTCUT & BACKUP */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Platform Settings & Security Configuration</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Secret Admin Keyboard Shortcut
                  </label>
                  <input
                    type="text"
                    value={settings.adminShortcut}
                    onChange={(e) => setSettings({ ...settings, adminShortcut: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Default: Ctrl+Shift+A</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Two-Factor Authentication (2FA)
                  </label>
                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.admin2FAEnabled}
                        onChange={(e) => setSettings({ ...settings, admin2FAEnabled: e.target.checked })}
                      />
                      <span>Enable 2FA Pin Verification</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Student Ranking & Percentile Visibility
                  </label>
                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.showRankingToStudents}
                        onChange={(e) => setSettings({ ...settings, showRankingToStudents: e.target.checked })}
                      />
                      <span>Show Rank & Percentile on Student Scorecard</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => handleSaveSettings(settings)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-xl text-xs shadow-md"
                >
                  Save Platform Settings
                </button>
              </div>
            </div>

            {/* Administrator Master Password Management */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Administrator Master Password & Credentials</h3>
              </div>
              <p className="text-xs text-slate-400">
                Update the primary master password for administrative access to the platform.
              </p>

              {adminPasswordStatus && (
                <div
                  className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    adminPasswordStatus.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                      : 'bg-red-950/60 border border-red-800 text-red-300'
                  }`}
                >
                  {adminPasswordStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{adminPasswordStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleChangeAdminPassword} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Current Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPasswordForm.currentPassword}
                    onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      New Password (min 6 chars)
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPasswordForm.newPassword}
                      onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPasswordForm.confirmPassword}
                      onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adminPasswordLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2 px-5 rounded-xl text-xs shadow-md transition-colors"
                >
                  {adminPasswordLoading ? 'Updating Password...' : 'Save New Admin Password'}
                </button>
              </form>
            </div>

            {/* Supabase Cloud Database Storage */}
            <div className="bg-slate-900 border border-indigo-900/40 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-indigo-400">
                  <Database className="w-5 h-5" />
                  <h3 className="font-bold text-base text-white">Supabase Cloud Database Storage</h3>
                </div>
                {supabaseStatus?.isSupabaseConfigured ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Supabase Persistent Storage Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Local Filesystem Fallback (Awaiting Secrets)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Permanent, persistent storage engine backed by Supabase PostgreSQL <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono">public.app_data</code> (Row ID: 1).
                Data persists reliably across all container restarts, deployments, and redeployments.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500">Storage Engine:</span>{' '}
                  <span className="text-slate-200 font-semibold">{supabaseStatus?.engine === 'supabase' ? 'Supabase PostgreSQL (Cloud)' : 'Local File JSON (data/database.json)'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Target Table:</span>{' '}
                  <span className="text-indigo-400 font-semibold">public.app_data (id=1, data=jsonb)</span>
                </div>
                <div>
                  <span className="text-slate-500">SUPABASE_URL Secret:</span>{' '}
                  <span className={supabaseStatus?.supabaseUrlConfigured ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                    {supabaseStatus?.supabaseUrlConfigured ? 'Configured' : 'Missing (Set in Secrets)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">SUPABASE_SERVICE_ROLE_KEY:</span>{' '}
                  <span className={supabaseStatus?.serviceKeyConfigured ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                    {supabaseStatus?.serviceKeyConfigured ? 'Configured (Server-Side)' : 'Missing (Set in Secrets)'}
                  </span>
                </div>
                {supabaseStatus?.lastRemoteUpdatedAt && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Last Cloud Sync Timestamp:</span>{' '}
                    <span className="text-slate-300">{new Date(supabaseStatus.lastRemoteUpdatedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {supabaseActionMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center justify-between ${
                  supabaseActionMsg.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' :
                  supabaseActionMsg.type === 'error' ? 'bg-rose-950/60 text-rose-300 border border-rose-800' :
                  'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
                }`}>
                  <span>{supabaseActionMsg.text}</span>
                  <button onClick={() => setSupabaseActionMsg(null)} className="text-slate-400 hover:text-white ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={supabaseLoading}
                  onClick={async () => {
                    setSupabaseLoading(true);
                    setSupabaseActionMsg(null);
                    try {
                      const res = await fetch('/api/admin/supabase-test', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${adminToken}` }
                      });
                      const data = await res.json();
                      if (data.success) {
                        setSupabaseActionMsg({ type: 'success', text: data.message });
                      } else {
                        setSupabaseActionMsg({ type: 'error', text: data.message || 'Persistence test failed' });
                      }
                      fetchSupabaseStatus();
                    } catch (err: any) {
                      setSupabaseActionMsg({ type: 'error', text: 'Error executing test: ' + err.message });
                    } finally {
                      setSupabaseLoading(false);
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${supabaseLoading ? 'animate-spin' : ''}`} />
                  {supabaseLoading ? 'Testing Persistence...' : 'Test Cloud Connection & Persistence'}
                </button>

                <button
                  type="button"
                  disabled={supabaseLoading}
                  onClick={async () => {
                    if (confirm('Do you want to migrate current local database records into Supabase public.app_data (row id=1)?')) {
                      setSupabaseLoading(true);
                      setSupabaseActionMsg(null);
                      try {
                        const res = await fetch('/api/admin/supabase-migrate', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
                          body: JSON.stringify({ force: false })
                        });
                        const data = await res.json();
                        if (data.success) {
                          setSupabaseActionMsg({ type: 'success', text: data.message });
                          refreshAllData();
                        } else {
                          setSupabaseActionMsg({ type: 'error', text: data.message || 'Migration failed' });
                        }
                        fetchSupabaseStatus();
                      } catch (err: any) {
                        setSupabaseActionMsg({ type: 'error', text: 'Migration request error: ' + err.message });
                      } finally {
                        setSupabaseLoading(false);
                      }
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors"
                >
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  Migrate Local JSON to Supabase
                </button>

                <button
                  type="button"
                  onClick={() => setShowSqlMigration(!showSqlMigration)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors ml-auto"
                >
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  {showSqlMigration ? 'Hide RPC SQL' : 'View Concurrency RPC SQL'}
                </button>
              </div>

              {showSqlMigration && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-indigo-400">PostgreSQL Transactional Lock & RPC Function (supabase_schema.sql)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const sql = `-- Transactional Locking & Concurrency Control Function\ncreate or replace function public.save_app_data(\n  target_id integer,\n  new_data jsonb,\n  expected_updated_at timestamptz default null\n)\nreturns table (id integer, updated_at timestamptz)\nlanguage plpgsql\nsecurity definer\nas $$\ndeclare\n  current_row public.app_data%rowtype;\nbegin\n  select * into current_row\n  from public.app_data\n  where app_data.id = target_id\n  for update;\n\n  if found then\n    if expected_updated_at is not null and current_row.updated_at != expected_updated_at then\n      raise exception 'CONCURRENT_MODIFICATION_CONFLICT: Row % was updated by another process at % (expected %)', target_id, current_row.updated_at, expected_updated_at;\n    end if;\n\n    update public.app_data\n    set data = new_data,\n        updated_at = clock_timestamp()\n    where app_data.id = target_id\n    returning app_data.id, app_data.updated_at into id, updated_at;\n    return next;\n  else\n    insert into public.app_data (id, data, updated_at)\n    values (target_id, new_data, clock_timestamp())\n    returning app_data.id, app_data.updated_at into id, updated_at;\n    return next;\n  end if;\nend;\n$$;\n\ngrant execute on function public.save_app_data(integer, jsonb, timestamptz) to service_role;`;
                        navigator.clipboard.writeText(sql);
                      }}
                      className="text-xs text-indigo-300 hover:text-white bg-indigo-950/80 border border-indigo-800 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Copy SQL
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto p-3 bg-slate-900 rounded-xl border border-slate-800 whitespace-pre">
{`-- Execute in Supabase SQL Editor for transactional concurrency locking
create or replace function public.save_app_data(
  target_id integer,
  new_data jsonb,
  expected_updated_at timestamptz default null
)
returns table (id integer, updated_at timestamptz)
language plpgsql
security definer
as $$
declare
  current_row public.app_data%rowtype;
begin
  select * into current_row
  from public.app_data
  where app_data.id = target_id
  for update;

  if found then
    if expected_updated_at is not null and current_row.updated_at != expected_updated_at then
      raise exception 'CONCURRENT_MODIFICATION_CONFLICT: Row % was updated at % (expected %)', target_id, current_row.updated_at, expected_updated_at;
    end if;

    update public.app_data
    set data = new_data,
        updated_at = clock_timestamp()
    where app_data.id = target_id
    returning app_data.id, app_data.updated_at into id, updated_at;
    return next;
  else
    insert into public.app_data (id, data, updated_at)
    values (target_id, new_data, clock_timestamp())
    returning app_data.id, app_data.updated_at into id, updated_at;
    return next;
  end if;
end;
$$;

grant execute on function public.save_app_data(integer, jsonb, timestamptz) to service_role;`}
                  </pre>
                </div>
              )}
            </div>

            {/* Database Backup & Restore */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white">Database Backup & Disaster Recovery</h3>
              <p className="text-xs text-slate-400">
                Generate an immediate full-state JSON archive containing all questions, students, results, doubts, and audit logs.
              </p>
              <div className="flex gap-4">
                <a
                  href="/api/backup/export"
                  download
                  className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Download Full Database Backup
                </a>
              </div>
            </div>

            {/* System Data Reset & Launch Preparation */}
            <div className="bg-slate-900 border border-rose-900/40 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">System Data Reset & Launch Preparation</h3>
              </div>
              <p className="text-xs text-slate-400">
                Purge all registered candidate accounts, test attempts, questions, and examinations to establish a clean state with 0 students, 0 exams, and 0 questions ready for fresh intake and test scheduling.
              </p>
              <div>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Are you sure you want to purge all candidate accounts, test attempts, questions, and examinations? This gives a clean start with 0 students, 0 exams, and 0 questions.')) {
                      try {
                        const res = await fetch('/api/admin/purge-data', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${adminToken}` }
                        });
                        const data = await res.json();
                        if (res.ok) {
                          alert(data.message || 'Platform state cleanly reset to 0 students, exams, and questions!');
                          refreshAllData();
                        } else {
                          alert(data.error || 'Failed to purge data.');
                        }
                      } catch (err: any) {
                        alert('Error purging data: ' + err.message);
                      }
                    }
                  }}
                  className="bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clean Start (Reset Students, Exams & Questions)
                </button>
              </div>
            </div>

            {/* Audit Logs */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white">System Security Audit Trail ({auditLogs.length})</h3>
              <div className="max-h-60 overflow-y-auto space-y-2 font-mono text-[11px]">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="text-indigo-400 font-bold mr-2">[{log.action}]</span>
                      <span>{log.details}</span>
                    </div>
                    <span className="text-slate-500 shrink-0 ml-3">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* REJECT STUDENT MODAL */}
      {rejectModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Reject Candidate Registration</h3>
                <p className="text-xs text-slate-400">{rejectModalStudent.fullName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Please specify the reason for rejection. This will be recorded and displayed to the student candidate if they attempt to sign in.
            </p>

            <div className="space-y-3 mb-5">
              <label className="block text-xs font-semibold uppercase text-slate-400">Select or Enter Reason</label>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {[
                  'Application does not meet enrollment criteria',
                  'Incomplete registration details / invalid contact info',
                  'Duplicate registration account detected',
                  'Batch capacity currently full',
                  'Fee / verification document pending'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectionReason(reason)}
                    className={`text-left p-2 rounded-xl text-xs transition-colors border ${
                      rejectionReason === reason
                        ? 'bg-rose-950/40 border-rose-600 text-rose-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Or type a custom rejection reason..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setRejectModalStudent(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2 rounded-xl text-xs shadow-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Delete Student Account</h3>
                <p className="text-xs text-rose-400 font-medium">Permanent Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this candidate account? This action cannot be reversed.
            </p>

            <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 space-y-1">
              <div className="font-bold text-sm text-white">{studentToDelete.fullName}</div>
              <div className="text-xs font-mono text-indigo-400">Roll / Reg: {studentToDelete.regNo}</div>
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-900/60 rounded-xl text-[11px] text-rose-300/90 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                All associated test attempts, scores, and faculty doubt questions for this candidate will be permanently removed.
              </span>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-medium py-2 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={handleDeleteStudent}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs shadow-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingStudent ? 'Deleting...' : 'Delete Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CHANGE PASSWORD MODAL */}
      {isAdminPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100">
            <button
              onClick={() => {
                setIsAdminPasswordModalOpen(false);
                setAdminPasswordStatus(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Change Admin Password</h3>
                <p className="text-xs text-slate-400">Update master security credentials</p>
              </div>
            </div>

            {adminPasswordStatus && (
              <div
                className={`mb-4 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  adminPasswordStatus.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border border-red-800 text-red-300'
                }`}
              >
                {adminPasswordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{adminPasswordStatus.message}</span>
              </div>
            )}

            <form onSubmit={handleChangeAdminPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Current Master Password
                </label>
                <input
                  type="password"
                  required
                  value={adminPasswordForm.currentPassword}
                  onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  New Master Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  value={adminPasswordForm.newPassword}
                  onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={adminPasswordForm.confirmPassword}
                  onChange={(e) => setAdminPasswordForm({ ...adminPasswordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminPasswordModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminPasswordLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs shadow-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  {adminPasswordLoading ? 'Updating Password...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
