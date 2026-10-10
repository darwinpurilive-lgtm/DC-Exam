export interface User {
  id: string;
  role: 'admin' | 'student';
  fullName?: string;
  email: string;
  registrationNumber?: string;
  batchId?: string;
  batchName?: string;
  status?: 'Pending' | 'Approved' | 'Rejected' | 'Suspended' | 'Deactivated';
  rejectionReason?: string;
  profilePhoto?: string;
}

export interface Student {
  id: string;
  registrationNumber: string;
  fullName: string;
  email: string;
  mobile: string;
  batchId: string;
  batchName?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Suspended' | 'Deactivated';
  rejectionReason?: string;
  profilePhoto?: string;
  dateOfBirth?: string;
  guardianInfo?: {
    name: string;
    mobile: string;
    relationship: string;
  };
  createdAt: string;
  approvedAt?: string;
  totalAttempts?: number;
  averagePercentage?: number;
}

export interface Batch {
  id: string;
  name: string;
  targetExam: string;
  description?: string;
  studentCount?: number;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  topics: string[];
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctAnswerId?: string;
  explanation?: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  negativeMarks: number;
  questionSource?: string;
  questionType?: 'MCQ' | 'Multiple' | 'Numerical';
  status?: 'Approved' | 'Draft' | 'Archived';
  selectedOptionId?: string | null;
  isCorrect?: boolean;
  isAnswered?: boolean;
  qNo?: number;
}

export interface Examination {
  id: string;
  name: string;
  description: string;
  subject: string;
  topics: string[];
  mode?: 'online';
  startDate: string;
  endDate: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarkingEnabled: boolean;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
  maxAttempts: number;
  randomizeQuestionOrder: boolean;
  randomizeOptionOrder: boolean;
  resultReleaseMode: 'immediate' | 'scheduled' | 'manual';
  resultReleaseDate?: string;
  status: 'Draft' | 'Scheduled' | 'Live' | 'Completed' | 'Archived';
  batchIds: string[];
  questionIds: string[];
  questionCount?: number;
  timerWarnings: {
    visualWarningMinutes: number;
    prominentWarningMinutes: number;
    criticalWarningMinutes: number;
  };
  security: {
    fullScreenRequired: boolean;
    disableCopyPaste: boolean;
    trackTabSwitches: boolean;
  };
  showCorrectAnswersAfterRelease: boolean;
  showExplanationsAfterRelease: boolean;
  studentAttempt?: {
    id: string;
    status: 'in_progress' | 'submitted' | 'expired';
    score?: number;
    percentage?: number;
    submittedTime?: string;
  } | null;
}

export interface StudentAnswer {
  questionId: string;
  selectedOptionId: string | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
  lastSavedAt?: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  startTime: string;
  deadlineTime: string;
  submittedTime?: string;
  status: 'in_progress' | 'submitted' | 'expired';
  answers: Record<string, StudentAnswer>;
  tabSwitchCount: number;
  score?: number;
  maxScore?: number;
  percentage?: number;
  accuracy?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  negativeDeductions?: number;
  subjectScores?: Record<string, { marks: number; total: number; correct: number; incorrect: number }>;
  rank?: number;
  percentile?: number;
}

export interface StudentDoubt {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  title: string;
  question: string;
  imageUrl?: string;
  pdfUrl?: string;
  status: 'Pending' | 'In Review' | 'Answered' | 'Closed';
  adminReply?: string;
  adminReplyAttachment?: string;
  repliedAt?: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  targetBatchId: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'approval' | 'exam' | 'result' | 'doubt' | 'announcement';
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  admin: string;
  details: string;
  targetId?: string;
  timestamp: string;
}

export interface PlatformSettings {
  instituteName: string;
  contactEmail: string;
  contactPhone: string;
  timeZone: string;
  adminShortcut: string;
  admin2FAEnabled: boolean;
  aiDailyLimitPerStudent: number;
  showRankingToStudents: boolean;
  defaultExamDuration: number;
  defaultMarksPerQuestion: number;
  defaultNegativeMarks: number;
}
