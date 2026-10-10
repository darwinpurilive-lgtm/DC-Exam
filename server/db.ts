// Server-side database engine with Supabase persistent cloud storage,
// atomic in-process serialization, and local JSON safety mirroring.
import fs from 'fs';
import path from 'path';
import {
  isSupabaseConfigured,
  fetchAppDataRow,
  upsertAppDataRow,
  testSupabaseDiagnostic
} from './supabase.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export interface Batch {
  id: string;
  name: string;
  targetExam: string; // e.g. Banking, Railway, SSC, OSSC, OSSSC, ALL
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
  isCorrect?: boolean; // Stripped before sending to students during active exam
}

export interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctAnswerId: string;
  explanation: string;
  subject: string;
  topic: string;
  subtopic?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  negativeMarks: number;
  questionSource?: string;
  questionType?: 'MCQ' | 'Multiple' | 'Numerical';
  status: 'Approved' | 'Draft' | 'Archived';
  createdAt: string;
  updatedAt: string;
}

export interface Examination {
  id: string;
  name: string;
  description: string;
  subject: string;
  topics: string[];
  mode: 'online' | 'offline';
  startDate: string; // ISO
  endDate: string;   // ISO
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
  batchIds: string[]; // Batches eligible
  questionIds: string[];
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
  createdAt: string;
  updatedAt: string;
}

export interface StudentAnswer {
  questionId: string;
  selectedOptionId: string | null;
  markedForReview: boolean;
  timeSpentSeconds: number;
  lastSavedAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  startTime: string; // ISO server time
  deadlineTime: string; // ISO server time
  submittedTime?: string;
  status: 'in_progress' | 'submitted' | 'expired';
  answers: Record<string, StudentAnswer>; // questionId -> answer
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

export interface Student {
  id: string;
  registrationNumber: string;
  fullName: string;
  email: string;
  mobile: string;
  passwordHash: string;
  batchId: string;
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
  targetBatchId: string; // 'all' or batchId
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string; // studentId or 'all'
  title: string;
  message: string;
  type: 'approval' | 'exam' | 'result' | 'doubt' | 'announcement';
  read: boolean;
  link?: string;
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
  adminShortcut: string; // default "Ctrl+Shift+A"
  admin2FAEnabled: boolean;
  admin2FASecret?: string;
  backgroundMusicEnabled: boolean;
  defaultMusicVolume: number; // 0.05 - 0.08
  audioTracks: { id: string; name: string; url: string; active: boolean }[];
  aiDailyLimitPerStudent: number;
  showRankingToStudents: boolean;
  defaultExamDuration: number;
  defaultMarksPerQuestion: number;
  defaultNegativeMarks: number;
}

export interface DatabaseSchema {
  students: Student[];
  admin: {
    username: string;
    email: string;
    passwordHash: string;
    twoFactorSecret?: string;
  };
  batches: Batch[];
  subjects: Subject[];
  questions: Question[];
  examinations: Examination[];
  attempts: ExamAttempt[];
  doubts: StudentDoubt[];
  announcements: Announcement[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  settings: PlatformSettings;
}

// In-memory cache + Supabase sync
let dbCache: DatabaseSchema | null = null;
let lastRemoteUpdatedAt: string | null = null;

// Mutex / write queue to serialize all database writes and prevent concurrent race conditions
let writeQueue: Promise<any> = Promise.resolve();

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const nextTask = writeQueue.then(task, task);
  writeQueue = nextTask.catch(() => {});
  return nextTask;
}

function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  } catch (err) {
    // If running in a read-only container, ignore directory creation errors
  }
}

/**
 * Safely saves a mirror copy to local filesystem as an additional safety layer
 */
function saveLocalMirror(db: DatabaseSchema) {
  try {
    ensureDirectories();
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err: any) {
    // Non-fatal if filesystem is read-only in serverless/container environment
    console.warn('[Storage Mirror] Notice: Could not write local filesystem mirror:', err.message);
  }
}

/**
 * Reads local database.json if available
 */
function readLocalDatabaseFile(): DatabaseSchema | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.batches)) {
        return parsed as DatabaseSchema;
      }
    }
  } catch (err: any) {
    console.warn('[Storage Local] Failed to read local database.json:', err.message);
  }
  return null;
}

export function getInitialDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    admin: {
      username: 'admin',
      email: 'admin@examportal.edu',
      passwordHash: 'admin123',
    },
    batches: [
      { id: 'batch_banking', name: 'Banking', targetExam: 'Banking', description: 'IBPS PO/Clerk, SBI PO/Clerk, RBI & Gramin Bank', createdAt: now },
      { id: 'batch_railway', name: 'Railway', targetExam: 'Railway', description: 'RRB NTPC, Group D, ALP & Technician', createdAt: now },
      { id: 'batch_ssc', name: 'SSC', targetExam: 'SSC', description: 'SSC CGL, CHSL, MTS, CPO & GD Constable', createdAt: now },
      { id: 'batch_ossc', name: 'OSSC', targetExam: 'OSSC', description: 'Odisha SSC CGL, Combined Auditor, Statistical Surveyor', createdAt: now },
      { id: 'batch_osssc', name: 'OSSSSC', targetExam: 'OSSSSC', description: 'Odisha SSSC RI, ARI, Amin, JA & Panchayat Executive', createdAt: now },
      { id: 'batch_all', name: 'ALL', targetExam: 'ALL', description: 'Common Competitive Batch (All Examinations)', createdAt: now }
    ],
    subjects: [
      {
        id: 'sub_math',
        name: 'Math',
        code: 'MATH',
        topics: [
          'Arithmetic & Simplification',
          'Percentage & Profit Loss',
          'Ratio & Proportion',
          'Time, Work & Distance',
          'Algebra & Number System',
          'Data Interpretation (DI)',
          'Geometry & Mensuration',
          'Quadratic Equations & Series'
        ]
      },
      {
        id: 'sub_reasoning',
        name: 'Reasoning',
        code: 'REAS',
        topics: [
          'Syllogism & Deductions',
          'Seating Arrangement & Puzzles',
          'Coding-Decoding',
          'Blood Relations & Direction',
          'Inequalities & Ranking',
          'Analogy & Classification',
          'Non-Verbal & Series',
          'Statement & Assumptions'
        ]
      },
      {
        id: 'sub_gk',
        name: 'GK',
        code: 'GK',
        topics: [
          'Indian History & Freedom Struggle',
          'Indian Polity & Constitution',
          'Geography (India & World)',
          'General Science (Physics/Chem/Bio)',
          'Indian Economy & Budget',
          'Odisha State GK & Heritage',
          'Static GK & Important Days',
          'Art, Culture & Literature'
        ]
      },
      {
        id: 'sub_ca',
        name: 'Current Affairs',
        code: 'CA',
        topics: [
          'National & International Affairs',
          'Banking & Economic News',
          'Government Schemes & Portals',
          'Awards, Honors & Summits',
          'Sports & Championships',
          'Science, Defense & Space',
          'Appointments & Obituaries',
          'Books, Authors & Indices'
        ]
      },
      {
        id: 'sub_english',
        name: 'English',
        code: 'ENG',
        topics: [
          'Reading Comprehension',
          'Error Spotting & Grammar',
          'Cloze Test & Fillers',
          'Para Jumbles & Sentence Rearrangement',
          'Synonyms & Antonyms',
          'Idioms & Phrases',
          'One Word Substitution',
          'Spelling & Vocabulary'
        ]
      },
      {
        id: 'sub_computer',
        name: 'Computer',
        code: 'COMP',
        topics: [
          'Computer Fundamentals & History',
          'Hardware & Input/Output Devices',
          'Operating Systems (Windows/Linux)',
          'MS Office (Word, Excel, PowerPoint)',
          'Computer Networks & Internet',
          'Cyber Security & Malwares',
          'Database Concepts (DBMS)',
          'Shortcuts, Abbreviations & Extensions'
        ]
      }
    ],
    questions: [],
    examinations: [],
    students: [],
    attempts: [],
    doubts: [],
    announcements: [],
    notifications: [],
    auditLogs: [
      {
        id: 'log_init',
        action: 'PLATFORM_INITIALIZED',
        admin: 'System Root',
        details: 'Competitive Examination Platform cleanly initialized with 0 students, 0 exams, and 0 questions.',
        timestamp: now
      }
    ],
    settings: {
      instituteName: '',
      contactEmail: 'administration@examportal.edu',
      contactPhone: '+91 11 2345 6789',
      timeZone: 'Asia/Kolkata',
      adminShortcut: 'Ctrl+Shift+A',
      admin2FAEnabled: false,
      backgroundMusicEnabled: true,
      defaultMusicVolume: 0.06,
      audioTracks: [
        {
          id: 'track_alpha',
          name: 'Alpha Waves 432Hz (Deep Focus & Flow)',
          url: 'synth:alpha',
          active: true
        },
        {
          id: 'track_theta',
          name: 'Theta Memory Waves (Calm Focus)',
          url: 'synth:theta',
          active: false
        },
        {
          id: 'track_zen',
          name: 'Binaural Zen Ambient (Distraction Blocker)',
          url: 'synth:zen',
          active: false
        },
        {
          id: 'track_brown',
          name: 'Warm Brown Noise (Acoustic Shield)',
          url: 'synth:brown',
          active: false
        }
      ],
      aiDailyLimitPerStudent: 30,
      showRankingToStudents: true,
      defaultExamDuration: 60,
      defaultMarksPerQuestion: 4,
      defaultNegativeMarks: 1
    }
  };
}

/**
 * Initializes the database subsystem at server boot.
 * - If Supabase credentials are configured: loads row 1 from public.app_data.
 *   If row 1 does not exist, idempotently seeds or migrates existing local data into Supabase.
 * - If Supabase credentials are missing: falls back safely to local database.json with prominent log warnings.
 */
export async function initializeDatabase(): Promise<{
  success: boolean;
  storage: 'supabase' | 'local_fallback';
  message: string;
  remoteUpdatedAt?: string;
}> {
  if (isSupabaseConfigured()) {
    console.log('[Storage Engine] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY detected. Connecting to Supabase public.app_data...');
    try {
      const row = await fetchAppDataRow(1);
      if (row && row.data) {
        dbCache = row.data as DatabaseSchema;
        lastRemoteUpdatedAt = row.updated_at;
        saveLocalMirror(dbCache);
        console.log(`[Storage Engine] Loaded persistent state from Supabase public.app_data (id=1, updated_at: ${row.updated_at}).`);
        console.log(`[Storage State] ${dbCache.students.length} students, ${dbCache.examinations.length} exams, ${dbCache.questions.length} questions.`);
        return {
          success: true,
          storage: 'supabase',
          message: 'Connected to Supabase persistent cloud database.',
          remoteUpdatedAt: row.updated_at
        };
      } else {
        // Row 1 does not exist in Supabase yet.
        // Check if existing local database.json has data to migrate
        const local = readLocalDatabaseFile();
        const dataToSave = local || getInitialDatabase();
        console.log('[Storage Engine] Row id=1 not found in public.app_data. Initializing persistent storage row 1...');
        const res = await upsertAppDataRow(1, dataToSave);
        dbCache = dataToSave;
        lastRemoteUpdatedAt = res.updated_at;
        saveLocalMirror(dbCache);
        console.log(`[Storage Engine] Successfully initialized row 1 in Supabase public.app_data.`);
        return {
          success: true,
          storage: 'supabase',
          message: 'Initialized persistent row 1 in Supabase public.app_data.',
          remoteUpdatedAt: res.updated_at
        };
      }
    } catch (err: any) {
      console.error('[Storage Engine FATAL ERROR] Failed to initialize from Supabase:', err.message);
      // Fail safely: Never overwrite Supabase with an empty database or fresh initial file
      const local = readLocalDatabaseFile();
      if (local) {
        dbCache = local;
        console.warn('[Storage Engine WARN] Running temporary in-memory session using existing local mirror. Supabase write operations will remain guarded.');
      }
      return {
        success: false,
        storage: 'supabase',
        message: `Supabase persistent database connection error: ${err.message}. Operation aborted to protect data integrity.`
      };
    }
  }

  // Fallback mode when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not yet configured in environment secrets
  console.warn('--------------------------------------------------------------------------------');
  console.warn('[Storage Notice] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured in environment secrets.');
  console.warn('[Storage Notice] Running in local filesystem mode (data/database.json).');
  console.warn('[Storage Notice] To connect to permanent Supabase storage:');
  console.warn('[Storage Notice] 1. Set SUPABASE_URL in your environment secrets.');
  console.warn('[Storage Notice] 2. Set SUPABASE_SERVICE_ROLE_KEY in your environment secrets.');
  console.warn('--------------------------------------------------------------------------------');

  const local = readLocalDatabaseFile() || getInitialDatabase();
  dbCache = local;
  saveLocalMirror(dbCache);
  return {
    success: true,
    storage: 'local_fallback',
    message: 'Running in local filesystem mode. Supabase environment secrets not set.'
  };
}

/**
 * Loads the database schema asynchronously.
 * Guarantees a fresh, valid database state.
 * Never silently replaces existing data with an empty database if Supabase fails.
 */
export async function loadDatabase(forceRefresh = false): Promise<DatabaseSchema> {
  if (dbCache && !forceRefresh) {
    return dbCache;
  }

  if (isSupabaseConfigured()) {
    try {
      const row = await fetchAppDataRow(1);
      if (row && row.data) {
        dbCache = row.data as DatabaseSchema;
        lastRemoteUpdatedAt = row.updated_at;
        saveLocalMirror(dbCache);
        return dbCache;
      }
    } catch (err: any) {
      console.error('[Storage Error] Could not load from Supabase:', err.message);
      if (dbCache) {
        console.warn('[Storage Warning] Serving cached memory database during temporary connection error.');
        return dbCache;
      }
      // If no cached memory exists and Supabase failed, fail safely with actionable error
      throw new Error(`[Storage Fatal] Supabase authoritative persistent database is unreachable (${err.message}). Halting request to prevent silent fallback to an empty database.`);
    }
  }

  // Fallback to local file or initial state only when Supabase is not configured
  if (!dbCache) {
    dbCache = readLocalDatabaseFile() || getInitialDatabase();
    saveLocalMirror(dbCache);
  }

  return dbCache;
}

/**
 * Durably saves the complete database schema.
 * All writes are executed sequentially through an asynchronous mutex queue
 * to ensure atomic persistence and prevent race conditions.
 */
export async function saveDatabase(db: DatabaseSchema): Promise<void> {
  return enqueueWrite(async () => {
    dbCache = db;

    // 1. Durably persist to Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const res = await upsertAppDataRow(1, db, lastRemoteUpdatedAt);
        lastRemoteUpdatedAt = res.updated_at;
      } catch (err: any) {
        console.error('[Storage ERROR] Failed to persist data to Supabase:', err.message);
        // Save local mirror so changes are kept on disk
        saveLocalMirror(db);
        throw new Error(`Failed to durably save data to Supabase: ${err.message}`);
      }
    }

    // 2. Also keep local mirror synchronized for resilience and export
    saveLocalMirror(db);
  });
}

/**
 * Adds an audit log entry durably to the database
 */
export async function addAuditLog(action: string, admin: string, details: string, targetId?: string): Promise<void> {
  const db = await loadDatabase();
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    action,
    admin,
    details,
    targetId,
    timestamp: new Date().toISOString()
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  await saveDatabase(db);
}

/**
 * Creates a complete JSON backup archive of the persistent database
 */
export async function createBackup(): Promise<{ fileName: string; content: string }> {
  const db = await loadDatabase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `exam_backup_${timestamp}.json`;
  const content = JSON.stringify(db, null, 2);

  try {
    ensureDirectories();
    fs.writeFileSync(path.join(BACKUP_DIR, fileName), content, 'utf-8');
  } catch (err: any) {
    console.warn('[Backup Notice] Local file writing unavailable. Backup generated in memory:', err.message);
  }

  await addAuditLog('DATABASE_BACKUP_CREATED', 'Administrator', `Created backup archive: ${fileName}`);
  return { fileName, content };
}

/**
 * Safe, idempotent migration function to transfer local JSON data to Supabase public.app_data
 */
export async function migrateLocalJsonToSupabase(force = false): Promise<{
  success: boolean;
  migrated: boolean;
  message: string;
  details?: any;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      migrated: false,
      message: 'Supabase is not configured. Please supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment secrets.'
    };
  }

  try {
    const existingRow = await fetchAppDataRow(1);
    if (existingRow && existingRow.data && !force) {
      return {
        success: true,
        migrated: false,
        message: `Supabase public.app_data already has existing data (row id=1, updated: ${existingRow.updated_at}). Migration skipped to protect existing remote data. Pass force=true if you explicitly intend to overwrite.`,
        details: {
          existingUpdatedAt: existingRow.updated_at,
          studentsCount: existingRow.data?.students?.length || 0,
          examsCount: existingRow.data?.examinations?.length || 0,
          questionsCount: existingRow.data?.questions?.length || 0
        }
      };
    }

    const localData = readLocalDatabaseFile();
    if (!localData) {
      return {
        success: false,
        migrated: false,
        message: 'No local database.json file found to migrate.'
      };
    }

    const res = await upsertAppDataRow(1, localData);
    dbCache = localData;
    lastRemoteUpdatedAt = res.updated_at;
    saveLocalMirror(localData);

    await addAuditLog(
      'SUPABASE_MIGRATION_COMPLETED',
      'Administrator',
      `Migrated local database to Supabase public.app_data (id=1) with ${localData.students.length} students, ${localData.examinations.length} exams, ${localData.questions.length} questions.`
    );

    return {
      success: true,
      migrated: true,
      message: `Successfully migrated local data to Supabase public.app_data (id=1, updated_at: ${res.updated_at}).`,
      details: {
        updatedAt: res.updated_at,
        studentsCount: localData.students.length,
        examsCount: localData.examinations.length,
        questionsCount: localData.questions.length
      }
    };
  } catch (err: any) {
    return {
      success: false,
      migrated: false,
      message: `Migration failed: ${err.message}`
    };
  }
}

/**
 * Performs a safe, non-destructive round-trip persistence and diagnostic check.
 * Strictly avoids polluting or modifying production records (row id=1).
 * Uses dedicated probe row (id=-999) with automatic cleanup.
 */
export async function testSupabasePersistence(): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
  details?: any;
}> {
  try {
    const diag = await testSupabaseDiagnostic();
    return {
      success: diag.connected && diag.writable && diag.cleanedUp,
      message: diag.message,
      latencyMs: diag.latencyMs,
      details: diag
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Diagnostic execution failed: ${err.message}`
    };
  }
}

/**
 * Returns diagnostic metadata about the current storage status
 */
export function getStorageStatus() {
  const configured = isSupabaseConfigured();
  return {
    engine: configured ? 'supabase' : 'local_fallback',
    isSupabaseConfigured: configured,
    supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
    serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY),
    lastRemoteUpdatedAt,
    hasMemoryCache: Boolean(dbCache),
    counts: dbCache ? {
      students: dbCache.students.length,
      examinations: dbCache.examinations.length,
      questions: dbCache.questions.length,
      attempts: dbCache.attempts.length,
      doubts: dbCache.doubts.length,
      batches: dbCache.batches.length,
      subjects: dbCache.subjects.length
    } : null
  };
}
