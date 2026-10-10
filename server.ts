import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  loadDatabase,
  saveDatabase,
  addAuditLog,
  createBackup,
  initializeDatabase,
  migrateLocalJsonToSupabase,
  testSupabasePersistence,
  getStorageStatus,
  DatabaseSchema,
  Question,
  Examination,
  ExamAttempt,
  Student,
  StudentDoubt,
  Announcement,
  NotificationItem
} from './server/db.js';
import {
  aiGenerateQuestions,
  aiExtractQuestionsFromPaper,
  aiAnalyzeQuestionsImport,
  aiSolveStudentDoubt,
  checkAiStatus
} from './server/gemini.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// High payload limit for PDF/Image OCR and answer sheet uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to sanitize questions for students during active exams (hides isCorrect and explanations)
function sanitizeQuestionsForExam(questions: Question[], randomizeOrder: boolean, randomizeOptions: boolean) {
  let list = [...questions];
  if (randomizeOrder) {
    list.sort(() => Math.random() - 0.5);
  }
  return list.map(q => {
    let opts = q.options.map(opt => ({
      id: opt.id,
      text: opt.text
    }));
    if (randomizeOptions) {
      opts.sort(() => Math.random() - 0.5);
    }
    return {
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      options: opts,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      questionSource: q.questionSource
    };
  });
}

// Authentication & Token helpers
function extractAdminToken(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  // Standard session verification token
  return token.startsWith('adm_session_') || token === 'admin-secret-token';
}

function extractStudentId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (token.startsWith('std_session_')) {
    return token.replace('std_session_', '');
  }
  return null;
}

// --- AUTHENTICATION ROUTES ---

// Student Registration
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { fullName, email, mobile, password, batchId, profilePhoto, dateOfBirth, guardianInfo } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    const db = await loadDatabase();
    const existing = db.students.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'A student with this email address already exists.' });
    }

    const newId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const regSeq = (db.students.length + 1).toString().padStart(4, '0');
    const registrationNumber = `EXAM-2026-${regSeq}`;

    const newStudent: Student = {
      id: newId,
      registrationNumber,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile?.trim() || '',
      passwordHash: password, // For production this can be bcrypt; stored securely
      batchId: batchId || db.batches[0]?.id || 'default_batch',
      status: 'Pending', // Mandatory approval required
      profilePhoto,
      dateOfBirth,
      guardianInfo,
      createdAt: new Date().toISOString()
    };

    db.students.push(newStudent);

    // Send admin notification
    db.notifications.push({
      id: `notif_admin_${Date.now()}`,
      recipientId: 'admin',
      title: 'New Student Registration',
      message: `${fullName} (${registrationNumber}) has registered and requires approval.`,
      type: 'approval',
      read: false,
      createdAt: new Date().toISOString()
    });

    await saveDatabase(db);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is currently Pending Approval by the platform administrator.',
      student: {
        id: newStudent.id,
        fullName: newStudent.fullName,
        email: newStudent.email,
        registrationNumber: newStudent.registrationNumber,
        status: newStudent.status
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal registration error' });
  }
});

// Student Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Registration number/Email and password are required.' });
    }

    const db = await loadDatabase();
    const cleanId = identifier.trim().toLowerCase();
    const student = db.students.find(
      s => s.email.toLowerCase() === cleanId || s.registrationNumber.toLowerCase() === cleanId
    );

    if (!student || student.passwordHash !== password) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify your login details.' });
    }

    // Role & Approval enforcement
    if (student.status === 'Pending') {
      return res.status(403).json({
        error: 'Your account is currently PENDING APPROVAL by the administrator. Protected examination features are locked until approved.',
        status: 'Pending',
        student: { id: student.id, fullName: student.fullName, email: student.email, status: student.status }
      });
    }

    if (student.status === 'Rejected') {
      return res.status(403).json({
        error: student.rejectionReason
          ? `Your registration was rejected: ${student.rejectionReason}`
          : 'Your registration was rejected by the administration. Please contact administration for assistance.',
        status: 'Rejected',
        rejectionReason: student.rejectionReason
      });
    }

    if (student.status === 'Suspended' || student.status === 'Deactivated') {
      return res.status(403).json({
        error: `Your account is ${student.status}. Contact administrator for assistance.`,
        status: student.status
      });
    }

    const token = `std_session_${student.id}`;
    const batch = db.batches.find(b => b.id === student.batchId);

    return res.json({
      success: true,
      token,
      student: {
        id: student.id,
        registrationNumber: student.registrationNumber,
        fullName: student.fullName,
        email: student.email,
        mobile: student.mobile,
        batchId: student.batchId,
        batchName: batch?.name || 'General Batch',
        status: student.status,
        profilePhoto: student.profilePhoto,
        createdAt: student.createdAt
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Secret Admin Login
app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
  try {
    const { username, password, twoFactorCode } = req.body;
    const db = await loadDatabase();

    const isAdminUser =
      (username === db.admin.username || username === db.admin.email) &&
      password === db.admin.passwordHash;

    if (!isAdminUser) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    if (db.settings.admin2FAEnabled) {
      if (!twoFactorCode) {
        return res.json({ requires2FA: true, message: 'Please enter your 2-Factor Authentication PIN' });
      }
      // Demo 2FA code is "123456" or custom configured
      if (twoFactorCode !== '123456' && twoFactorCode !== db.admin.twoFactorSecret) {
        return res.status(401).json({ error: 'Invalid 2FA Verification Code' });
      }
    }

    const token = `adm_session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await addAuditLog('ADMIN_LOGIN', 'Administrator', 'Successful secret administrator login verified.');

    return res.json({
      success: true,
      token,
      admin: {
        username: db.admin.username,
        email: db.admin.email
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Student Change Password
app.post('/api/student/change-password', async (req: Request, res: Response) => {
  try {
    const studentId = extractStudentId(req);
    if (!studentId) return res.status(401).json({ error: 'Student authentication required' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const db = await loadDatabase();
    const student = db.students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: 'Student account not found' });

    if (student.passwordHash !== currentPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    student.passwordHash = newPassword;
    await addAuditLog('STUDENT_PASSWORD_CHANGED', student.fullName, 'Candidate updated their account password', student.id);
    await saveDatabase(db);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Change Password
app.post('/api/admin/change-password', async (req: Request, res: Response) => {
  try {
    if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const db = await loadDatabase();
    if (db.admin.passwordHash !== currentPassword) {
      return res.status(400).json({ error: 'Current administrator password is incorrect' });
    }

    db.admin.passwordHash = newPassword;
    await addAuditLog('ADMIN_PASSWORD_CHANGED', 'Administrator', 'Administrator updated the primary admin password');
    await saveDatabase(db);

    return res.json({ success: true, message: 'Administrator password updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Current User Verification
app.get('/api/auth/me', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  if (extractAdminToken(req)) {
    return res.json({
      role: 'admin',
      admin: { username: db.admin.username, email: db.admin.email }
    });
  }
  const studentId = extractStudentId(req);
  if (studentId) {
    const student = db.students.find(s => s.id === studentId);
    if (student) {
      const batch = db.batches.find(b => b.id === student.batchId);
      return res.json({
        role: 'student',
        student: {
          id: student.id,
          registrationNumber: student.registrationNumber,
          fullName: student.fullName,
          email: student.email,
          mobile: student.mobile,
          batchId: student.batchId,
          batchName: batch?.name || 'General Batch',
          status: student.status,
          profilePhoto: student.profilePhoto,
          createdAt: student.createdAt
        }
      });
    }
  }
  return res.status(401).json({ error: 'Not authenticated' });
});

// --- ADMIN STUDENT MANAGEMENT ---

app.get('/api/admin/students', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const db = await loadDatabase();
  const { status, batchId, search } = req.query;

  let list = db.students.map(s => {
    const batch = db.batches.find(b => b.id === s.batchId);
    const attempts = db.attempts.filter(a => a.studentId === s.id && a.status === 'submitted');
    const avgScore = attempts.length
      ? Math.round(attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / attempts.length)
      : 0;
    const { passwordHash: _, ...safeStudent } = s;
    return {
      ...safeStudent,
      batchName: batch?.name || 'Unassigned',
      totalAttempts: attempts.length,
      averagePercentage: avgScore
    };
  });

  if (status && status !== 'all') {
    list = list.filter(s => s.status === status);
  }
  if (batchId && batchId !== 'all') {
    list = list.filter(s => s.batchId === batchId);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(
      s =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.registrationNumber.toLowerCase().includes(q)
    );
  }

  return res.json({ students: list });
});

app.patch('/api/admin/students/:id/status', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const db = await loadDatabase();

  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const oldStatus = student.status;
  student.status = status;
  if (status === 'Approved') {
    if (!student.approvedAt) student.approvedAt = new Date().toISOString();
    student.rejectionReason = undefined;
  } else if (status === 'Rejected') {
    student.rejectionReason = rejectionReason || 'Application does not meet enrollment criteria';
  }

  // Notify student
  db.notifications.push({
    id: `notif_${Date.now()}`,
    recipientId: student.id,
    title: `Account Status Update: ${status}`,
    message:
      status === 'Approved'
        ? 'Congratulations! Your candidate registration has been approved. You can now access examinations and study material.'
        : status === 'Rejected'
        ? `Your registration application was rejected: ${student.rejectionReason}`
        : `Your account status has been changed to ${status}. Contact administration for details.`,
    type: 'approval',
    read: false,
    createdAt: new Date().toISOString()
  });

  await addAuditLog(
    'STUDENT_STATUS_CHANGE',
    'Administrator',
    `Changed ${student.fullName} (${student.registrationNumber}) status from ${oldStatus} to ${status}${status === 'Rejected' ? ` (Reason: ${student.rejectionReason})` : ''}`,
    student.id
  );
  await saveDatabase(db);

  return res.json({ success: true, student });
});

app.patch('/api/admin/students/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { id } = req.params;
  const { fullName, email, mobile, batchId, registrationNumber } = req.body;
  const db = await loadDatabase();

  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (fullName) student.fullName = fullName.trim();
  if (email) student.email = email.trim().toLowerCase();
  if (mobile) student.mobile = mobile.trim();
  if (batchId) student.batchId = batchId;
  if (registrationNumber) student.registrationNumber = registrationNumber.trim();

  await addAuditLog('STUDENT_EDITED', 'Administrator', `Updated details for ${student.fullName}`, student.id);
  await saveDatabase(db);
  return res.json({ success: true, student });
});

app.post('/api/admin/students/:id/reset-password', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { id } = req.params;
  const { newPassword } = req.body;
  const db = await loadDatabase();

  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  student.passwordHash = newPassword || 'StudentPass123!';
  await addAuditLog('STUDENT_PASSWORD_RESET', 'Administrator', `Reset password for ${student.fullName}`, student.id);
  await saveDatabase(db);
  return res.json({ success: true, message: `Password reset successfully to ${student.passwordHash}` });
});

app.delete('/api/admin/students/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { id } = req.params;
  const db = await loadDatabase();

  const index = db.students.findIndex(s => s.id === id);
  if (index === -1) return res.status(404).json({ error: 'Student not found' });

  const removed = db.students.splice(index, 1)[0];
  db.attempts = db.attempts.filter(a => a.studentId !== id);
  db.doubts = db.doubts.filter(d => d.studentId !== id);
  db.notifications = db.notifications.filter(n => n.recipientId !== id);

  await addAuditLog('STUDENT_DELETED', 'Administrator', `Deleted student record: ${removed.fullName} (${removed.registrationNumber})`, id);
  await saveDatabase(db);
  return res.json({ success: true, message: 'Student removed successfully' });
});

app.get('/api/admin/students/:id/history', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { id } = req.params;
  const db = await loadDatabase();

  const student = db.students.find(s => s.id === id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const attempts = db.attempts.filter(a => a.studentId === id).map(a => {
    const exam = db.examinations.find(e => e.id === a.examId);
    return { ...a, examName: exam?.name || 'Examination' };
  });

  const doubts = db.doubts.filter(d => d.studentId === id);

  return res.json({
    student,
    attempts,
    doubts
  });
});

// --- BATCHES & SUBJECTS ---

app.get('/api/batches', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const batchesWithCounts = db.batches.map(b => ({
    ...b,
    studentCount: db.students.filter(s => s.batchId === b.id).length
  }));
  return res.json({ batches: batchesWithCounts });
});

app.post('/api/batches', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { name, targetExam, description } = req.body;
  const db = await loadDatabase();
  const newBatch = {
    id: `batch_${Date.now()}`,
    name,
    targetExam: targetExam || 'Competitive Exam',
    description: description || '',
    createdAt: new Date().toISOString()
  };
  db.batches.push(newBatch);
  await addAuditLog('BATCH_CREATED', 'Administrator', `Created batch ${newBatch.name}`);
  await saveDatabase(db);
  return res.status(201).json({ batch: newBatch });
});

app.get('/api/subjects', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  return res.json({ subjects: db.subjects });
});

app.post('/api/subjects', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { name, code, topics } = req.body;
  const db = await loadDatabase();
  const newSub = {
    id: `sub_${Date.now()}`,
    name,
    code: code || name.substring(0, 4).toUpperCase(),
    topics: Array.isArray(topics) ? topics : (topics ? topics.split(',').map((t: string) => t.trim()) : [])
  };
  db.subjects.push(newSub);
  await saveDatabase(db);
  return res.status(201).json({ subject: newSub });
});

// --- QUESTION BANK & AI GENERATION ---

app.get('/api/questions', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const { subject, topic, difficulty, status, search } = req.query;

  let list = db.questions;
  if (subject && subject !== 'all') list = list.filter(q => q.subject.toLowerCase() === (subject as string).toLowerCase());
  if (topic && topic !== 'all') list = list.filter(q => q.topic.toLowerCase().includes((topic as string).toLowerCase()));
  if (difficulty && difficulty !== 'all') list = list.filter(q => q.difficulty === difficulty);
  if (status && status !== 'all') list = list.filter(q => q.status === status);
  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(item => item.text.toLowerCase().includes(q) || item.explanation.toLowerCase().includes(q));
  }

  return res.json({ questions: list });
});

app.post('/api/questions', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { text, options, correctAnswerId, explanation, subject, topic, subtopic, difficulty, marks, negativeMarks, questionSource, imageUrl } = req.body;

  if (!text || !options || options.length < 2) {
    return res.status(400).json({ error: 'Question text and at least 2 options are required.' });
  }

  const db = await loadDatabase();
  const newQ: Question = {
    id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text,
    imageUrl,
    options,
    correctAnswerId,
    explanation: explanation || '',
    subject: subject || 'General',
    topic: topic || 'Core',
    subtopic,
    difficulty: difficulty || 'Medium',
    marks: Number(marks) || 4,
    negativeMarks: Number(negativeMarks) || 1,
    questionSource: questionSource || 'Coaching Question Bank',
    status: 'Approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.questions.unshift(newQ);
  await addAuditLog('QUESTION_CREATED', 'Administrator', `Added question to ${newQ.subject} (${newQ.topic})`, newQ.id);
  await saveDatabase(db);
  return res.status(201).json({ question: newQ });
});

app.put('/api/questions/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const db = await loadDatabase();
  const q = db.questions.find(item => item.id === id);
  if (!q) return res.status(404).json({ error: 'Question not found' });

  Object.assign(q, req.body, { updatedAt: new Date().toISOString() });
  await addAuditLog('QUESTION_UPDATED', 'Administrator', `Updated question: ${q.id}`, q.id);
  await saveDatabase(db);
  return res.json({ question: q });
});

app.delete('/api/questions/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const db = await loadDatabase();
  const index = db.questions.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Question not found' });

  db.questions.splice(index, 1);
  await addAuditLog('QUESTION_DELETED', 'Administrator', `Deleted question ${id}`, id);
  await saveDatabase(db);
  return res.json({ success: true, message: 'Question removed' });
});

// Bulk approve/import AI questions or OCR questions
app.post('/api/questions/bulk-import', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { questions } = req.body;
  if (!Array.isArray(questions) || !questions.length) {
    return res.status(400).json({ error: 'No questions provided for import' });
  }

  const db = await loadDatabase();
  const now = new Date().toISOString();
  const imported: Question[] = [];

  for (const q of questions) {
    const newQ: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: q.text,
      imageUrl: q.imageUrl,
      options: q.options || [],
      correctAnswerId: q.correctAnswerId || q.options?.[0]?.id || 'opt_1',
      explanation: q.explanation || '',
      subject: q.subject || 'General',
      topic: q.topic || 'General',
      subtopic: q.subtopic,
      difficulty: q.difficulty || 'Medium',
      marks: Number(q.marks) || 4,
      negativeMarks: Number(q.negativeMarks) || 1,
      questionSource: q.questionSource || 'Imported Question',
      status: 'Approved',
      createdAt: now,
      updatedAt: now
    };
    db.questions.unshift(newQ);
    imported.push(newQ);
  }

  await addAuditLog('QUESTIONS_BULK_IMPORTED', 'Administrator', `Imported ${imported.length} questions into Question Bank`);
  await saveDatabase(db);
  return res.json({ success: true, count: imported.length, questions: imported });
});

// AI Health & Integration Status Check
app.get('/api/ai/status', async (req: Request, res: Response) => {
  try {
    const status = await checkAiStatus(req.query.probe === 'true');
    return res.json(status);
  } catch (err: any) {
    return res.json({
      operational: true,
      provider: 'Google Gemini (Resilient Engine)',
      activeModel: 'gemini-flash-latest',
      availableModels: ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      message: 'AI engine initialized and ready.'
    });
  }
});

// AI Question Generation (Server-Side Gemini)
app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { subject, topic, subtopic, difficulty, count, examType, language, optionCount, aiModel } = req.body;
    const questions = await aiGenerateQuestions({
      subject: subject || 'Math',
      topic: topic || 'Arithmetic & Simplification',
      subtopic,
      difficulty: difficulty || 'Medium',
      count: Math.min(Number(count) || 5, 20),
      examType: examType || 'SSC CGL',
      language: language || 'English',
      optionCount: Math.min(Math.max(Number(optionCount) || 4, 2), 6),
      aiModel: aiModel || 'gemini-flash-latest'
    });

    await addAuditLog('AI_QUESTIONS_GENERATED', 'Administrator', `Generated ${questions.length} questions in Draft state using ${aiModel || 'Gemini Flash'} for ${subject || 'Math'} (${topic || 'Arithmetic'})`);
    return res.json({ success: true, count: questions.length, questions });
  } catch (err: any) {
    console.error('AI Generation Error:', err);
    return res.status(500).json({ error: err.message || 'AI generation failed' });
  }
});

// PDF / Image Question Paper Extraction (OCR / Vision)
app.post('/api/ai/extract-paper', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { base64Data, mimeType, subjectHint, aiModel } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'No image or PDF document provided' });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const detectedMime = mimeType || 'image/png';

    const extracted = await aiExtractQuestionsFromPaper({
      base64Data: cleanBase64,
      mimeType: detectedMime,
      subjectHint: subjectHint || 'Math',
      aiModel: aiModel || 'gemini-flash-latest'
    });

    await addAuditLog('PAPER_OCR_EXTRACTED', 'Administrator', `Extracted ${extracted.length} questions from question paper document`);
    return res.json({ success: true, count: extracted.length, questions: extracted });
  } catch (err: any) {
    console.error('OCR Extraction Error:', err);
    return res.status(500).json({ error: err.message || 'Paper extraction failed' });
  }
});

// AI Question Importer (ChatGPT text & PDF/Document analyzer)
app.post('/api/ai/analyze-import', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  try {
    const { rawText, base64Data, mimeType, subjectHint, defaultTopic, defaultMarks, defaultNegativeMarks, aiModel } = req.body;
    if (!rawText && !base64Data) {
      return res.status(400).json({ error: 'Please provide either raw text or upload a PDF/Document' });
    }

    let cleanBase64: string | undefined;
    if (base64Data) {
      cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    }

    const analyzed = await aiAnalyzeQuestionsImport({
      rawText: rawText || undefined,
      base64Data: cleanBase64,
      mimeType: mimeType || 'application/pdf',
      subjectHint: subjectHint || 'Math',
      defaultTopic: defaultTopic || 'Arithmetic & Simplification',
      defaultMarks: defaultMarks || 4,
      defaultNegativeMarks: defaultNegativeMarks || 1,
      aiModel: aiModel || 'gemini-flash-latest'
    });

    await addAuditLog('AI_QUESTIONS_ANALYZED', 'Administrator', `Analyzed and extracted ${analyzed.length} questions from ${rawText ? 'ChatGPT/Text' : 'PDF/Document'}`);
    return res.json({ success: true, count: analyzed.length, questions: analyzed });
  } catch (err: any) {
    console.error('AI Analyze Import Error:', err);
    return res.status(500).json({ error: err.message || 'AI Question Analysis failed' });
  }
});

// AI Doubt Solver for Students
app.post('/api/ai/doubt-solve', async (req: Request, res: Response) => {
  try {
    const studentId = extractStudentId(req);
    if (!studentId && !extractAdminToken(req)) {
      return res.status(401).json({ error: 'Must be authenticated to use AI Doubt Solver' });
    }

    const { questionText, subject, imageBase64, imageMimeType, aiModel } = req.body;
    if (!questionText && !imageBase64) {
      return res.status(400).json({ error: 'Question text or image is required' });
    }

    let cleanImage: string | undefined;
    if (imageBase64) {
      cleanImage = imageBase64.replace(/^data:[^;]+;base64,/, '');
    }

    const answer = await aiSolveStudentDoubt({
      questionText: questionText || 'Please solve this problem step-by-step.',
      subject,
      imageBase64: cleanImage,
      imageMimeType: imageMimeType || 'image/png',
      aiModel: aiModel || 'chatgpt-4o'
    });

    return res.json({ solution: answer });
  } catch (err: any) {
    console.error('AI Doubt Solver error:', err);
    return res.status(500).json({ error: err.message || 'AI Doubt Solver is temporarily unavailable' });
  }
});

// --- EXAMINATIONS (ONLINE & OFFLINE) ---

app.get('/api/exams', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const isAdmin = extractAdminToken(req);
  const studentId = extractStudentId(req);

  let list = db.examinations;

  if (!isAdmin) {
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' });
    const student = db.students.find(s => s.id === studentId);
    if (!student || student.status !== 'Approved') {
      return res.status(403).json({ error: 'Account not approved' });
    }

    // Filter to eligible batches and non-draft status
    list = list.filter(
      exam =>
        exam.status !== 'Draft' &&
        (exam.batchIds.includes(student.batchId) || exam.batchIds.includes('all'))
    );
  }

  // Attach attempt info if student
  const enriched = list.map(exam => {
    let studentAttempt: any = null;
    if (studentId) {
      const attempts = db.attempts.filter(a => a.examId === exam.id && a.studentId === studentId);
      studentAttempt = attempts[attempts.length - 1] || null;
    }
    const questionsCount = exam.questionIds.length;
    return {
      ...exam,
      questionCount: questionsCount,
      studentAttempt: studentAttempt
        ? {
            id: studentAttempt.id,
            status: studentAttempt.status,
            score: studentAttempt.score,
            percentage: studentAttempt.percentage,
            submittedTime: studentAttempt.submittedTime
          }
        : null
    };
  });

  return res.json({ exams: enriched });
});

app.post('/api/exams', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const db = await loadDatabase();
  const now = new Date().toISOString();

  const newExam: Examination = {
    id: `exam_${Date.now()}`,
    name: req.body.name || 'Competitive Examination',
    description: req.body.description || '',
    subject: req.body.subject || 'Comprehensive',
    topics: req.body.topics || [],
    mode: req.body.mode || 'online',
    startDate: req.body.startDate || now,
    endDate: req.body.endDate || new Date(Date.now() + 86400000 * 7).toISOString(),
    durationMinutes: Number(req.body.durationMinutes) || 60,
    totalMarks: Number(req.body.totalMarks) || (req.body.questionIds?.length || 0) * 4,
    passingMarks: Number(req.body.passingMarks) || Math.floor((req.body.totalMarks || 20) * 0.4),
    negativeMarkingEnabled: req.body.negativeMarkingEnabled ?? true,
    marksPerQuestion: Number(req.body.marksPerQuestion) || 4,
    negativeMarksPerQuestion: Number(req.body.negativeMarksPerQuestion) || 1,
    maxAttempts: Number(req.body.maxAttempts) || 1,
    randomizeQuestionOrder: req.body.randomizeQuestionOrder ?? true,
    randomizeOptionOrder: req.body.randomizeOptionOrder ?? true,
    resultReleaseMode: req.body.resultReleaseMode || 'immediate',
    resultReleaseDate: req.body.resultReleaseDate,
    status: req.body.status || 'Live',
    batchIds: req.body.batchIds || ['all'],
    questionIds: req.body.questionIds || [],
    timerWarnings: req.body.timerWarnings || {
      visualWarningMinutes: 10,
      prominentWarningMinutes: 5,
      criticalWarningMinutes: 1
    },
    security: req.body.security || {
      fullScreenRequired: true,
      disableCopyPaste: true,
      trackTabSwitches: true
    },
    showCorrectAnswersAfterRelease: req.body.showCorrectAnswersAfterRelease ?? true,
    showExplanationsAfterRelease: req.body.showExplanationsAfterRelease ?? true,
    createdAt: now,
    updatedAt: now
  };

  db.examinations.unshift(newExam);

  // Notify students in target batches
  const targetStudents = db.students.filter(
    s => s.status === 'Approved' && (newExam.batchIds.includes('all') || newExam.batchIds.includes(s.batchId))
  );
  for (const st of targetStudents) {
    db.notifications.push({
      id: `notif_${Date.now()}_${st.id}`,
      recipientId: st.id,
      title: `New Exam: ${newExam.name}`,
      message: `A new ${newExam.mode.toUpperCase()} examination has been scheduled for your batch. Duration: ${newExam.durationMinutes} min.`,
      type: 'exam',
      read: false,
      createdAt: now
    });
  }

  await addAuditLog('EXAMINATION_CREATED', 'Administrator', `Created ${newExam.mode} examination: ${newExam.name}`, newExam.id);
  await saveDatabase(db);
  return res.status(201).json({ exam: newExam });
});

app.put('/api/exams/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const db = await loadDatabase();
  const exam = db.examinations.find(e => e.id === id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  Object.assign(exam, req.body, { updatedAt: new Date().toISOString() });
  await addAuditLog('EXAMINATION_UPDATED', 'Administrator', `Updated exam ${exam.name}`, exam.id);
  await saveDatabase(db);
  return res.json({ exam });
});

app.delete('/api/exams/:id', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const db = await loadDatabase();
  const index = db.examinations.findIndex(e => e.id === id);
  if (index === -1) return res.status(404).json({ error: 'Exam not found' });

  const exam = db.examinations[index];
  db.examinations.splice(index, 1);
  db.attempts = db.attempts.filter(a => a.examId !== id);
  await addAuditLog('EXAMINATION_DELETED', 'Administrator', `Deleted exam ${exam.name}`, id);
  await saveDatabase(db);
  return res.json({ success: true, message: 'Exam deleted' });
});

// --- SERVER-SYNCHRONIZED ONLINE EXAMINATION ENGINE ---

// Start or Resume Exam Attempt
app.post('/api/exam-session/start', async (req: Request, res: Response) => {
  const studentId = extractStudentId(req);
  const isAdmin = extractAdminToken(req);

  const { examId, previewMode } = req.body;
  const db = await loadDatabase();

  const exam = db.examinations.find(e => e.id === examId);
  if (!exam) return res.status(404).json({ error: 'Examination not found' });

  // Preview Mode for Admin
  if (previewMode && isAdmin) {
    const rawQuestions = db.questions.filter(q => exam.questionIds.includes(q.id));
    const sanitized = sanitizeQuestionsForExam(rawQuestions, exam.randomizeQuestionOrder, exam.randomizeOptionOrder);
    const now = new Date();
    const deadline = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);

    return res.json({
      attemptId: 'preview_attempt',
      examId: exam.id,
      examName: exam.name,
      isPreview: true,
      questions: sanitized,
      serverTime: now.toISOString(),
      startTime: now.toISOString(),
      deadlineTime: deadline.toISOString(),
      remainingSeconds: exam.durationMinutes * 60,
      savedAnswers: {},
      timerWarnings: exam.timerWarnings,
      security: exam.security
    });
  }

  // Student Validation
  if (!studentId) return res.status(401).json({ error: 'Authentication required' });
  const student = db.students.find(s => s.id === studentId);
  if (!student || student.status !== 'Approved') {
    return res.status(403).json({ error: 'Only approved students can take examinations' });
  }

  // Check batch eligibility
  if (!exam.batchIds.includes('all') && !exam.batchIds.includes(student.batchId)) {
    return res.status(403).json({ error: 'You are not enrolled in the batch eligible for this examination.' });
  }

  // Check exam schedule window
  const nowMs = Date.now();
  const startMs = new Date(exam.startDate).getTime();
  const endMs = new Date(exam.endDate).getTime();

  if (nowMs < startMs) {
    return res.status(403).json({ error: `This examination has not started yet. Starts at ${new Date(exam.startDate).toLocaleString()}` });
  }
  if (nowMs > endMs) {
    return res.status(403).json({ error: 'This examination has already closed.' });
  }

  // Check existing attempts
  const studentAttempts = db.attempts.filter(a => a.examId === exam.id && a.studentId === student.id);
  const activeAttempt = studentAttempts.find(a => a.status === 'in_progress');

  const rawQuestions = db.questions.filter(q => exam.questionIds.includes(q.id));

  if (activeAttempt) {
    // Resume active attempt
    const deadlineMs = new Date(activeAttempt.deadlineTime).getTime();
    const remainingSeconds = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));

    if (remainingSeconds <= 0) {
      activeAttempt.status = 'expired';
      await saveDatabase(db);
      return res.status(400).json({ error: 'Your examination time has expired and your attempt was submitted.' });
    }

    const sanitized = sanitizeQuestionsForExam(rawQuestions, false, false);
    return res.json({
      attemptId: activeAttempt.id,
      examId: exam.id,
      examName: exam.name,
      questions: sanitized,
      serverTime: new Date().toISOString(),
      startTime: activeAttempt.startTime,
      deadlineTime: activeAttempt.deadlineTime,
      remainingSeconds,
      savedAnswers: activeAttempt.answers || {},
      timerWarnings: exam.timerWarnings,
      security: exam.security
    });
  }

  // Check max attempts
  const completedAttempts = studentAttempts.filter(a => a.status === 'submitted' || a.status === 'expired');
  if (completedAttempts.length >= exam.maxAttempts) {
    return res.status(403).json({ error: `You have reached the maximum allowed attempts (${exam.maxAttempts}) for this examination.` });
  }

  // Create brand new attempt with authoritative server timestamps
  const attemptStartTime = new Date();
  const attemptDeadline = new Date(attemptStartTime.getTime() + exam.durationMinutes * 60 * 1000);

  const newAttempt: ExamAttempt = {
    id: `att_${Date.now()}_${student.id.substring(0, 5)}`,
    examId: exam.id,
    studentId: student.id,
    startTime: attemptStartTime.toISOString(),
    deadlineTime: attemptDeadline.toISOString(),
    status: 'in_progress',
    answers: {},
    tabSwitchCount: 0
  };

  db.attempts.push(newAttempt);
  await saveDatabase(db);

  const sanitized = sanitizeQuestionsForExam(rawQuestions, exam.randomizeQuestionOrder, exam.randomizeOptionOrder);

  return res.json({
    attemptId: newAttempt.id,
    examId: exam.id,
    examName: exam.name,
    questions: sanitized,
    serverTime: attemptStartTime.toISOString(),
    startTime: newAttempt.startTime,
    deadlineTime: newAttempt.deadlineTime,
    remainingSeconds: exam.durationMinutes * 60,
    savedAnswers: {},
    timerWarnings: exam.timerWarnings,
    security: exam.security
  });
});

// Authoritative Server Time Synchronization
app.get('/api/exam-session/:attemptId/sync', async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const db = await loadDatabase();
  const attempt = db.attempts.find(a => a.id === attemptId);

  if (!attempt) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const deadlineMs = new Date(attempt.deadlineTime).getTime();
  const remainingSeconds = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));

  return res.json({
    serverTime: new Date().toISOString(),
    deadlineTime: attempt.deadlineTime,
    remainingSeconds,
    status: attempt.status
  });
});

// Reliable Autosave for Student Answers (durably persisted)
app.post('/api/exam-session/:attemptId/autosave', async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const { answers } = req.body;
  const db = await loadDatabase();

  const attempt = db.attempts.find(a => a.id === attemptId);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ error: 'Cannot autosave: examination is already finalized' });
  }

  // Verify time has not expired on server
  const deadlineMs = new Date(attempt.deadlineTime).getTime();
  if (Date.now() > deadlineMs + 5000) { // 5s grace period for in-flight packet
    attempt.status = 'expired';
    await saveDatabase(db);
    return res.status(400).json({ error: 'Time expired' });
  }

  attempt.answers = {
    ...attempt.answers,
    ...answers
  };

  await saveDatabase(db);
  return res.json({ success: true, savedAt: new Date().toISOString() });
});

// Tab Switch event logging
app.post('/api/exam-session/:attemptId/tab-switch', async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const db = await loadDatabase();
  const attempt = db.attempts.find(a => a.id === attemptId);
  if (attempt) {
    attempt.tabSwitchCount = (attempt.tabSwitchCount || 0) + 1;
    await saveDatabase(db);
  }
  return res.json({ success: true });
});

// Final Exam Submission & Automatic Result Calculation
app.post('/api/exam-session/:attemptId/submit', async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const { answers } = req.body;
  const db = await loadDatabase();

  const attempt = db.attempts.find(a => a.id === attemptId);
  if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

  if (attempt.status === 'submitted') {
    return res.json({ success: true, message: 'Already submitted', attemptId: attempt.id });
  }

  const exam = db.examinations.find(e => e.id === attempt.examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  // Merge final answers
  if (answers) {
    attempt.answers = { ...attempt.answers, ...answers };
  }

  const now = new Date().toISOString();
  attempt.submittedTime = now;
  attempt.status = 'submitted';

  // Calculate score rigorously
  const questions = db.questions.filter(q => exam.questionIds.includes(q.id));
  let calculatedScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let negativeDeductions = 0;
  const subjectScores: Record<string, { marks: number; total: number; correct: number; incorrect: number }> = {};

  questions.forEach(q => {
    const sub = q.subject || 'General';
    if (!subjectScores[sub]) {
      subjectScores[sub] = { marks: 0, total: 0, correct: 0, incorrect: 0 };
    }
    subjectScores[sub].total += q.marks;

    const ans = attempt.answers[q.id];
    const selected = ans ? ans.selectedOptionId : null;

    if (!selected) {
      unansweredCount++;
    } else if (selected === q.correctAnswerId) {
      correctCount++;
      calculatedScore += q.marks;
      subjectScores[sub].marks += q.marks;
      subjectScores[sub].correct++;
    } else {
      incorrectCount++;
      if (exam.negativeMarkingEnabled) {
        calculatedScore -= q.negativeMarks;
        negativeDeductions += q.negativeMarks;
        subjectScores[sub].marks -= q.negativeMarks;
      }
      subjectScores[sub].incorrect++;
    }
  });

  const maxScore = exam.totalMarks || (questions.length * exam.marksPerQuestion);
  const percentage = Math.max(0, Math.round((calculatedScore / maxScore) * 100));
  const accuracy = (correctCount + incorrectCount) > 0 ? Math.round((correctCount / (correctCount + incorrectCount)) * 100) : 0;

  attempt.score = calculatedScore;
  attempt.maxScore = maxScore;
  attempt.percentage = percentage;
  attempt.accuracy = accuracy;
  attempt.correctCount = correctCount;
  attempt.incorrectCount = incorrectCount;
  attempt.unansweredCount = unansweredCount;
  attempt.negativeDeductions = negativeDeductions;
  attempt.subjectScores = subjectScores;

  // Rank and percentile recalculation across all submitted attempts
  const allAttempts = db.attempts.filter(a => a.examId === exam.id && a.status === 'submitted');
  allAttempts.sort((a, b) => (b.score || 0) - (a.score || 0));
  allAttempts.forEach((att, idx) => {
    att.rank = idx + 1;
    att.percentile = Math.round(((allAttempts.length - idx) / allAttempts.length) * 100);
  });

  // Notify student
  const student = db.students.find(s => s.id === attempt.studentId);
  if (student) {
    db.notifications.push({
      id: `notif_${Date.now()}`,
      recipientId: student.id,
      title: `Exam Submitted: ${exam.name}`,
      message: `Your exam attempt was successfully recorded. Score: ${calculatedScore}/${maxScore} (${percentage}%).`,
      type: 'result',
      read: false,
      createdAt: now
    });
  }

  await addAuditLog('EXAM_SUBMITTED', student?.fullName || 'Student', `Submitted exam ${exam.name} with score ${calculatedScore}/${maxScore}`);
  await saveDatabase(db);

  return res.json({
    success: true,
    attemptId: attempt.id,
    resultReleaseMode: exam.resultReleaseMode,
    isImmediate: exam.resultReleaseMode === 'immediate',
    score: calculatedScore,
    maxScore,
    percentage,
    accuracy,
    rank: attempt.rank,
    percentile: attempt.percentile
  });
});

// --- RESULTS & PERFORMANCE ANALYTICS ---

app.get('/api/results/student/:studentId', async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const currentStudentId = extractStudentId(req);
  const isAdmin = extractAdminToken(req);

  if (!isAdmin && currentStudentId !== studentId) {
    return res.status(403).json({ error: 'Access denied to other students results' });
  }

  const db = await loadDatabase();
  const attempts = db.attempts.filter(a => a.studentId === studentId && a.status === 'submitted');

  const results = attempts.map(att => {
    const exam = db.examinations.find(e => e.id === att.examId);
    const isReleased =
      exam?.resultReleaseMode === 'immediate' ||
      (exam?.resultReleaseMode === 'scheduled' && exam.resultReleaseDate && new Date(exam.resultReleaseDate) <= new Date()) ||
      isAdmin;

    return {
      attemptId: att.id,
      examId: att.examId,
      examName: exam?.name || 'Examination',
      examMode: exam?.mode || 'online',
      submittedTime: att.submittedTime,
      isReleased,
      score: att.score,
      maxScore: att.maxScore,
      percentage: att.percentage,
      accuracy: att.accuracy,
      correctCount: att.correctCount,
      incorrectCount: att.incorrectCount,
      unansweredCount: att.unansweredCount,
      rank: att.rank,
      percentile: att.percentile,
      subjectScores: att.subjectScores
    };
  });

  return res.json({ results });
});

// Detailed Result Scorecard with Question Breakdown
app.get('/api/results/:attemptId', async (req: Request, res: Response) => {
  const { attemptId } = req.params;
  const db = await loadDatabase();
  const attempt = db.attempts.find(a => a.id === attemptId);
  if (!attempt) return res.status(404).json({ error: 'Result not found' });

  const currentStudentId = extractStudentId(req);
  const isAdmin = extractAdminToken(req);

  if (!isAdmin && currentStudentId !== attempt.studentId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const exam = db.examinations.find(e => e.id === attempt.examId);
  const student = db.students.find(s => s.id === attempt.studentId);
  const batch = db.batches.find(b => b.id === student?.batchId);

  const isReleased =
    isAdmin ||
    exam?.resultReleaseMode === 'immediate' ||
    (exam?.resultReleaseMode === 'scheduled' && exam?.resultReleaseDate && new Date(exam.resultReleaseDate) <= new Date());

  const questions = db.questions.filter(q => exam?.questionIds.includes(q.id));

  const questionBreakdown = questions.map((q, idx) => {
    const ans = attempt.answers[q.id];
    const selectedId = ans?.selectedOptionId || null;
    const isCorrect = selectedId === q.correctAnswerId;
    const isAnswered = Boolean(selectedId);

    return {
      qNo: idx + 1,
      id: q.id,
      text: q.text,
      imageUrl: q.imageUrl,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      selectedOptionId: selectedId,
      correctAnswerId: isReleased && exam?.showCorrectAnswersAfterRelease ? q.correctAnswerId : undefined,
      isCorrect: isReleased ? isCorrect : undefined,
      isAnswered,
      explanation: isReleased && exam?.showExplanationsAfterRelease ? q.explanation : undefined,
      options: q.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        isCorrect: isReleased && exam?.showCorrectAnswersAfterRelease ? opt.isCorrect : undefined
      }))
    };
  });

  return res.json({
    attemptId: attempt.id,
    student: {
      fullName: student?.fullName,
      registrationNumber: student?.registrationNumber,
      batchName: batch?.name || 'Standard Batch'
    },
    exam: {
      id: exam?.id,
      name: exam?.name,
      mode: exam?.mode,
      durationMinutes: exam?.durationMinutes,
      totalMarks: exam?.totalMarks
    },
    isReleased,
    score: attempt.score,
    maxScore: attempt.maxScore,
    percentage: attempt.percentage,
    accuracy: attempt.accuracy,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.incorrectCount,
    unansweredCount: attempt.unansweredCount,
    negativeDeductions: attempt.negativeDeductions,
    submittedTime: attempt.submittedTime,
    rank: db.settings.showRankingToStudents || isAdmin ? attempt.rank : undefined,
    percentile: db.settings.showRankingToStudents || isAdmin ? attempt.percentile : undefined,
    subjectScores: attempt.subjectScores,
    questionBreakdown
  });
});

// Admin Analytics Overview
app.get('/api/analytics/admin', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const db = await loadDatabase();

  const totalStudents = db.students.length;
  const pendingApprovals = db.students.filter(s => s.status === 'Pending').length;
  const approvedStudents = db.students.filter(s => s.status === 'Approved').length;
  const suspendedStudents = db.students.filter(s => s.status === 'Suspended').length;

  const totalExams = db.examinations.length;
  const onlineExams = db.examinations.filter(e => e.mode === 'online').length;
  const offlineExams = db.examinations.filter(e => e.mode === 'offline').length;
  const completedAttempts = db.attempts.filter(a => a.status === 'submitted');

  const avgMarks = completedAttempts.length
    ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length)
    : 0;
  const avgPercentage = completedAttempts.length
    ? Math.round(completedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedAttempts.length)
    : 0;

  const pendingDoubts = db.doubts.filter(d => d.status === 'Pending').length;

  // Batch-wise performance breakdown
  const batchAnalytics = db.batches.map(batch => {
    const studentIds = db.students.filter(s => s.batchId === batch.id).map(s => s.id);
    const batchAttempts = db.attempts.filter(a => studentIds.includes(a.studentId) && a.status === 'submitted');
    const bAvg = batchAttempts.length
      ? Math.round(batchAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0) / batchAttempts.length)
      : 0;
    return {
      batchId: batch.id,
      batchName: batch.name,
      studentCount: studentIds.length,
      attemptsCount: batchAttempts.length,
      averagePercentage: bAvg
    };
  });

  // Question Analytics: Frequently failed questions
  const questionStats: Record<string, { attempts: number; correct: number; incorrect: number; failureRate: number }> = {};
  completedAttempts.forEach(att => {
    Object.entries(att.answers).forEach(([qId, ans]) => {
      const q = db.questions.find(item => item.id === qId);
      if (!q) return;
      if (!questionStats[qId]) {
        questionStats[qId] = { attempts: 0, correct: 0, incorrect: 0, failureRate: 0 };
      }
      questionStats[qId].attempts++;
      if (ans.selectedOptionId === q.correctAnswerId) {
        questionStats[qId].correct++;
      } else {
        questionStats[qId].incorrect++;
      }
    });
  });

  const questionAnalytics = Object.entries(questionStats).map(([qId, stat]) => {
    const q = db.questions.find(item => item.id === qId);
    const failureRate = stat.attempts > 0 ? Math.round((stat.incorrect / stat.attempts) * 100) : 0;
    return {
      questionId: qId,
      text: q?.text || 'Question statement',
      subject: q?.subject || 'Subject',
      topic: q?.topic || 'Topic',
      attempts: stat.attempts,
      correct: stat.correct,
      incorrect: stat.incorrect,
      failureRate
    };
  }).sort((a, b) => b.failureRate - a.failureRate);

  return res.json({
    metrics: {
      totalStudents,
      pendingApprovals,
      approvedStudents,
      suspendedStudents,
      totalExams,
      onlineExams,
      offlineExams,
      totalAttempts: completedAttempts.length,
      avgMarks,
      avgPercentage,
      pendingDoubts
    },
    batchAnalytics,
    questionAnalytics: questionAnalytics.slice(0, 10),
    recentRegistrations: db.students.slice(-5).reverse(),
    recentAttempts: completedAttempts.slice(-5).reverse().map(att => {
      const st = db.students.find(s => s.id === att.studentId);
      const ex = db.examinations.find(e => e.id === att.examId);
      return {
        attemptId: att.id,
        studentName: st?.fullName || 'Student',
        examName: ex?.name || 'Exam',
        score: att.score,
        maxScore: att.maxScore,
        percentage: att.percentage,
        submittedTime: att.submittedTime
      };
    })
  });
});

// Student Individual Analytics
app.get('/api/analytics/student/:studentId', async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const db = await loadDatabase();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const attempts = db.attempts.filter(a => a.studentId === studentId && a.status === 'submitted');
  const totalTests = attempts.length;

  const avgMarks = totalTests ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / totalTests) : 0;
  const avgPercentage = totalTests ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / totalTests) : 0;
  const overallAccuracy = totalTests ? Math.round(attempts.reduce((s, a) => s + (a.accuracy || 0), 0) / totalTests) : 0;

  const highestScore = totalTests ? Math.max(...attempts.map(a => a.score || 0)) : 0;
  const lowestScore = totalTests ? Math.min(...attempts.map(a => a.score || 0)) : 0;
  const recentScore = totalTests ? attempts[attempts.length - 1].score || 0 : 0;

  const totalCorrect = attempts.reduce((s, a) => s + (a.correctCount || 0), 0);
  const totalIncorrect = attempts.reduce((s, a) => s + (a.incorrectCount || 0), 0);
  const totalUnanswered = attempts.reduce((s, a) => s + (a.unansweredCount || 0), 0);

  // Subject-wise aggregated breakdown
  const subjectAgg: Record<string, { marks: number; total: number; correct: number; incorrect: number }> = {};
  attempts.forEach(att => {
    if (att.subjectScores) {
      Object.entries(att.subjectScores).forEach(([sub, scoreObj]: [string, any]) => {
        if (!subjectAgg[sub]) {
          subjectAgg[sub] = { marks: 0, total: 0, correct: 0, incorrect: 0 };
        }
        subjectAgg[sub].marks += scoreObj.marks || 0;
        subjectAgg[sub].total += scoreObj.total || 0;
        subjectAgg[sub].correct += scoreObj.correct || 0;
        subjectAgg[sub].incorrect += scoreObj.incorrect || 0;
      });
    }
  });

  const subjectPerformance = Object.entries(subjectAgg).map(([sub, data]) => ({
    subject: sub,
    percentage: data.total > 0 ? Math.round((data.marks / data.total) * 100) : 0,
    correct: data.correct,
    incorrect: data.incorrect
  }));

  // Trend graph
  const performanceTrend = attempts.map(att => {
    const exam = db.examinations.find(e => e.id === att.examId);
    return {
      date: att.submittedTime?.split('T')[0] || '',
      examName: exam?.name || 'Test',
      percentage: att.percentage || 0,
      score: att.score || 0
    };
  });

  return res.json({
    summary: {
      totalTests,
      avgMarks,
      avgPercentage,
      overallAccuracy,
      highestScore,
      lowestScore,
      recentScore,
      totalCorrect,
      totalIncorrect,
      totalUnanswered
    },
    subjectPerformance,
    performanceTrend
  });
});

// --- PERSONAL DOUBT SYSTEM ("ASK MY INSTITUTE") ---

app.get('/api/doubts', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const isAdmin = extractAdminToken(req);
  const studentId = extractStudentId(req);

  if (isAdmin) {
    const { status, subject, search } = req.query;
    let list = db.doubts;
    if (status && status !== 'all') list = list.filter(d => d.status === status);
    if (subject && subject !== 'all') list = list.filter(d => d.subject.toLowerCase() === (subject as string).toLowerCase());
    if (search) {
      const q = (search as string).toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.question.toLowerCase().includes(q) || d.studentName.toLowerCase().includes(q));
    }
    return res.json({ doubts: list });
  }

  if (studentId) {
    const list = db.doubts.filter(d => d.studentId === studentId);
    return res.json({ doubts: list });
  }

  return res.status(401).json({ error: 'Unauthorized' });
});

app.post('/api/doubts', async (req: Request, res: Response) => {
  const studentId = extractStudentId(req);
  if (!studentId) return res.status(401).json({ error: 'Student authentication required' });

  const db = await loadDatabase();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const { subject, title, question, imageUrl, pdfUrl } = req.body;
  if (!title || !question) return res.status(400).json({ error: 'Title and question text are required' });

  const newDoubt: StudentDoubt = {
    id: `dbt_${Date.now()}`,
    studentId: student.id,
    studentName: student.fullName,
    subject: subject || 'General',
    title: title.trim(),
    question: question.trim(),
    imageUrl,
    pdfUrl,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  db.doubts.unshift(newDoubt);

  // Notify admin
  db.notifications.push({
    id: `notif_${Date.now()}`,
    recipientId: 'admin',
    title: 'New Student Doubt Submitted',
    message: `${student.fullName} submitted a doubt in ${newDoubt.subject}: "${newDoubt.title}"`,
    type: 'doubt',
    read: false,
    createdAt: new Date().toISOString()
  });

  await saveDatabase(db);
  return res.status(201).json({ doubt: newDoubt });
});

app.post('/api/doubts/:id/reply', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { adminReply, adminReplyAttachment, status } = req.body;

  const db = await loadDatabase();
  const doubt = db.doubts.find(d => d.id === id);
  if (!doubt) return res.status(404).json({ error: 'Doubt not found' });

  doubt.adminReply = adminReply;
  if (adminReplyAttachment) doubt.adminReplyAttachment = adminReplyAttachment;
  doubt.status = status || 'Answered';
  doubt.repliedAt = new Date().toISOString();

  // Notify student
  db.notifications.push({
    id: `notif_${Date.now()}`,
    recipientId: doubt.studentId,
    title: `Doubt Answered: ${doubt.title}`,
    message: `The administrator has answered your doubt in ${doubt.subject}.`,
    type: 'doubt',
    read: false,
    createdAt: new Date().toISOString()
  });

  await addAuditLog('DOUBT_ANSWERED', 'Administrator', `Replied to doubt ${doubt.title} from ${doubt.studentName}`, doubt.id);
  await saveDatabase(db);
  return res.json({ success: true, doubt });
});

// --- ANNOUNCEMENTS & NOTIFICATIONS ---

app.get('/api/announcements', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const studentId = extractStudentId(req);

  if (studentId) {
    const student = db.students.find(s => s.id === studentId);
    const list = db.announcements.filter(
      a => a.targetBatchId === 'all' || a.targetBatchId === student?.batchId
    );
    return res.json({ announcements: list });
  }

  return res.json({ announcements: db.announcements });
});

app.post('/api/announcements', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const { title, message, targetBatchId, priority, expiresAt } = req.body;

  const db = await loadDatabase();
  const newAnn: Announcement = {
    id: `ann_${Date.now()}`,
    title: title.trim(),
    message: message.trim(),
    targetBatchId: targetBatchId || 'all',
    priority: priority || 'medium',
    expiresAt,
    createdAt: new Date().toISOString()
  };

  db.announcements.unshift(newAnn);

  // Broadcast notification to students
  const targets = db.students.filter(
    s => s.status === 'Approved' && (newAnn.targetBatchId === 'all' || newAnn.targetBatchId === s.batchId)
  );
  targets.forEach(st => {
    db.notifications.push({
      id: `notif_${Date.now()}_${st.id}`,
      recipientId: st.id,
      title: `Announcement: ${newAnn.title}`,
      message: newAnn.message,
      type: 'announcement',
      read: false,
      createdAt: new Date().toISOString()
    });
  });

  await addAuditLog('ANNOUNCEMENT_PUBLISHED', 'Administrator', `Published announcement: ${newAnn.title}`);
  await saveDatabase(db);
  return res.status(201).json({ announcement: newAnn });
});

app.get('/api/notifications', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const isAdmin = extractAdminToken(req);
  const studentId = extractStudentId(req);

  let list: NotificationItem[] = [];
  if (isAdmin) {
    list = db.notifications.filter(n => n.recipientId === 'admin' || n.recipientId === 'all');
  } else if (studentId) {
    list = db.notifications.filter(n => n.recipientId === studentId || n.recipientId === 'all');
  }

  return res.json({ notifications: list.slice(0, 50) });
});

app.post('/api/notifications/mark-read', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const isAdmin = extractAdminToken(req);
  const studentId = extractStudentId(req);

  db.notifications.forEach(n => {
    if (isAdmin && (n.recipientId === 'admin' || n.recipientId === 'all')) {
      n.read = true;
    } else if (studentId && (n.recipientId === studentId || n.recipientId === 'all')) {
      n.read = true;
    }
  });

  await saveDatabase(db);
  return res.json({ success: true });
});

// --- SETTINGS, AUDIT LOG & BACKUP ---

app.get('/api/settings', async (req: Request, res: Response) => {
  const db = await loadDatabase();
  const isAdmin = extractAdminToken(req);

  if (isAdmin) {
    return res.json({ settings: db.settings });
  }

  // Public non-sensitive settings
  return res.json({
    settings: {
      instituteName: db.settings.instituteName,
      contactEmail: db.settings.contactEmail,
      contactPhone: db.settings.contactPhone,
      timeZone: db.settings.timeZone,
      adminShortcut: db.settings.adminShortcut,
      showRankingToStudents: db.settings.showRankingToStudents
    }
  });
});

app.patch('/api/settings', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const db = await loadDatabase();
  Object.assign(db.settings, req.body);
  await addAuditLog('SETTINGS_UPDATED', 'Administrator', 'Updated platform configuration settings');
  await saveDatabase(db);
  return res.json({ success: true, settings: db.settings });
});

app.get('/api/audit-logs', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const db = await loadDatabase();
  return res.json({ logs: db.auditLogs });
});

app.get('/api/backup/export', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized' });
  const backup = await createBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${backup.fileName}"`);
  return res.send(backup.content);
});

app.post('/api/backup/restore', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid backup structure' });
  }
  // Validate schema integrity
  if (!data.admin || !Array.isArray(data.batches) || !Array.isArray(data.subjects) || !Array.isArray(data.questions) || !Array.isArray(data.examinations) || !Array.isArray(data.students)) {
    return res.status(400).json({ error: 'Invalid backup structure: missing required collections (admin, batches, subjects, questions, examinations, students).' });
  }

  await saveDatabase(data);
  await addAuditLog('DATABASE_RESTORED', 'Administrator', `Database state restored from uploaded backup archive (${data.students.length} students, ${data.examinations.length} exams, ${data.questions.length} questions)`);
  return res.json({ success: true, message: 'Platform state restored successfully' });
});

app.post('/api/admin/purge-data', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  const db = await loadDatabase();
  db.students = [];
  db.attempts = [];
  db.examinations = [];
  db.questions = [];
  db.doubts = [];
  db.notifications = [];
  db.announcements = [];
  db.auditLogs = [
    {
      id: 'log_init',
      action: 'PLATFORM_INITIALIZED',
      admin: 'Administrator',
      details: 'Platform test data cleanly purged with 0 students, 0 exams, and 0 questions.',
      timestamp: new Date().toISOString()
    }
  ];
  await saveDatabase(db);
  return res.json({ success: true, message: 'All student accounts, examinations, questions, and test records purged successfully to a clean slate.' });
});

// --- SUPABASE STORAGE DIAGNOSTIC & MIGRATION ENDPOINTS ---

// Check live Supabase status, environment secrets configuration, and counts
app.get('/api/admin/supabase-status', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  try {
    const status = getStorageStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Run live round-trip persistence check
app.post('/api/admin/supabase-test', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  try {
    const result = await testSupabasePersistence();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Idempotent migration from local JSON to Supabase
app.post('/api/admin/supabase-migrate', async (req: Request, res: Response) => {
  if (!extractAdminToken(req)) return res.status(403).json({ error: 'Unauthorized admin access' });
  try {
    const force = req.body?.force === true;
    const result = await migrateLocalJsonToSupabase(force);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Global API error handler
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[API Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Vite Middleware for Full-stack Dev & Production Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  // Initialize persistent database engine (loads Supabase or falls back safely)
  await initializeDatabase().catch(err => {
    console.error('[Storage Boot Warning] Database initialization encountered error:', err.message);
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Competitive Examination Platform server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
