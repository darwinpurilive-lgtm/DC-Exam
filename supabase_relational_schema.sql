-- ============================================================================
-- DC Exam Platform - Complete Normalized Relational Database Schema
-- Supabase PostgreSQL Relational Schema & Migration Script
-- ============================================================================
-- To execute:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to SQL Editor > New Query
-- 3. Paste the entire script below and click Run (Ctrl+Enter / Cmd+Enter)
-- ============================================================================

-- Ensure uuid extension is available
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ADMINS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.admins (
  id text primary key,
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  two_factor_secret text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. BATCHES TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.batches (
  id text primary key,
  name text not null,
  target_exam text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. SUBJECTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.subjects (
  id text primary key,
  name text not null,
  code text not null unique,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. QUESTIONS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.questions (
  id text primary key,
  text text not null,
  image_url text,
  options jsonb not null default '[]'::jsonb,
  correct_answer_id text,
  explanation text,
  subject text not null,
  topic text not null,
  subtopic text,
  difficulty text not null default 'Medium',
  marks numeric not null default 4,
  negative_marks numeric not null default 1,
  question_source text,
  question_type text default 'MCQ',
  status text default 'Approved',
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_questions_subject on public.questions(subject);
create index if not exists idx_questions_topic on public.questions(topic);
create index if not exists idx_questions_difficulty on public.questions(difficulty);

-- ----------------------------------------------------------------------------
-- 5. EXAMINATIONS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.examinations (
  id text primary key,
  name text not null,
  description text,
  subject text not null,
  topics jsonb not null default '[]'::jsonb,
  mode text not null default 'online',
  start_date timestamptz,
  end_date timestamptz,
  duration_minutes integer not null default 60,
  total_marks numeric not null default 100,
  passing_marks numeric not null default 40,
  negative_marking_enabled boolean not null default true,
  marks_per_question numeric not null default 4,
  negative_marks_per_question numeric not null default 1,
  max_attempts integer not null default 1,
  randomize_question_order boolean not null default false,
  randomize_option_order boolean not null default false,
  result_release_mode text not null default 'immediate',
  result_release_date timestamptz,
  status text not null default 'Live',
  batch_ids jsonb not null default '["all"]'::jsonb,
  question_ids jsonb not null default '[]'::jsonb,
  timer_warnings jsonb default '{"visualWarningMinutes": 10, "prominentWarningMinutes": 5, "criticalWarningMinutes": 2}'::jsonb,
  security jsonb default '{"fullScreenRequired": false, "disableCopyPaste": true, "trackTabSwitches": true}'::jsonb,
  show_correct_answers_after_release boolean default true,
  show_explanations_after_release boolean default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_examinations_status on public.examinations(status);
create index if not exists idx_examinations_subject on public.examinations(subject);

-- ----------------------------------------------------------------------------
-- 6. STUDENTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id text primary key,
  registration_number text unique not null,
  full_name text not null,
  email text unique not null,
  mobile text not null default '',
  password_hash text not null,
  batch_id text not null references public.batches(id) on update cascade,
  status text not null default 'Pending',
  rejection_reason text,
  approved_at timestamptz,
  profile_photo text,
  date_of_birth text,
  guardian_info jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_students_email on public.students(email);
create index if not exists idx_students_reg_no on public.students(registration_number);
create index if not exists idx_students_status on public.students(status);
create index if not exists idx_students_batch on public.students(batch_id);

-- ----------------------------------------------------------------------------
-- 7. EXAM_ATTEMPTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.exam_attempts (
  id text primary key,
  exam_id text not null references public.examinations(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  start_time timestamptz not null default now(),
  deadline_time timestamptz not null,
  submitted_time timestamptz,
  status text not null default 'in_progress',
  answers jsonb not null default '{}'::jsonb,
  tab_switch_count integer not null default 0,
  score numeric default 0,
  max_score numeric default 0,
  percentage numeric default 0,
  accuracy numeric default 0,
  correct_count integer default 0,
  incorrect_count integer default 0,
  unanswered_count integer default 0,
  negative_deductions numeric default 0,
  subject_scores jsonb default '{}'::jsonb,
  rank integer,
  percentile numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_exam on public.exam_attempts(exam_id);
create index if not exists idx_attempts_student on public.exam_attempts(student_id);
create index if not exists idx_attempts_status on public.exam_attempts(status);

-- ----------------------------------------------------------------------------
-- 8. STUDENT_DOUBTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.student_doubts (
  id text primary key,
  student_id text not null references public.students(id) on delete cascade,
  student_name text not null,
  subject text not null,
  title text not null,
  question text not null,
  image_url text,
  pdf_url text,
  status text not null default 'Pending',
  admin_reply text,
  admin_reply_attachment text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_doubts_student on public.student_doubts(student_id);
create index if not exists idx_doubts_status on public.student_doubts(status);

-- ----------------------------------------------------------------------------
-- 9. ANNOUNCEMENTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.announcements (
  id text primary key,
  title text not null,
  message text not null,
  target_batch_id text not null default 'all',
  priority text not null default 'medium',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id text primary key,
  recipient_id text not null,
  title text not null,
  message text not null,
  type text not null default 'approval',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_id);
create index if not exists idx_notifications_read on public.notifications(read);

-- ----------------------------------------------------------------------------
-- 11. AUDIT_LOGS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id text primary key,
  action text not null,
  admin text not null,
  details text not null,
  target_id text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_audit_logs_timestamp on public.audit_logs(timestamp desc);

-- ----------------------------------------------------------------------------
-- 12. APP_SETTINGS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id text primary key default 'platform_settings',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
-- Enable RLS on all tables and grant access exclusively to server service_role
alter table public.admins enable row level security;
alter table public.batches enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.examinations enable row level security;
alter table public.students enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.student_doubts enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

-- Revoke direct anonymous client access for maximum security
revoke all on public.admins from anon, authenticated;
revoke all on public.batches from anon, authenticated;
revoke all on public.subjects from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.examinations from anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.exam_attempts from anon, authenticated;
revoke all on public.student_doubts from anon, authenticated;
revoke all on public.announcements from anon, authenticated;
revoke all on public.notifications from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
revoke all on public.app_settings from anon, authenticated;

-- Grant all permissions to service_role (used by server backend)
grant all on public.admins to service_role;
grant all on public.batches to service_role;
grant all on public.subjects to service_role;
grant all on public.questions to service_role;
grant all on public.examinations to service_role;
grant all on public.students to service_role;
grant all on public.exam_attempts to service_role;
grant all on public.student_doubts to service_role;
grant all on public.announcements to service_role;
grant all on public.notifications to service_role;
grant all on public.audit_logs to service_role;
grant all on public.app_settings to service_role;

-- ----------------------------------------------------------------------------
-- 13. AUTOMATED SAFE MIGRATION FUNCTION (From public.app_data row 1 to relational)
-- ----------------------------------------------------------------------------
create or replace function public.migrate_app_data_to_relational()
returns jsonb
language plpgsql
security definer
as $$
declare
  raw_doc jsonb;
  item jsonb;
  stats jsonb;
  admin_rec jsonb;
  settings_rec jsonb;
  c_batches int := 0;
  c_subjects int := 0;
  c_students int := 0;
  c_questions int := 0;
  c_exams int := 0;
  c_attempts int := 0;
  c_doubts int := 0;
  c_announcements int := 0;
  c_notifications int := 0;
  c_logs int := 0;
begin
  -- Fetch row 1 from existing public.app_data without modifying or deleting it
  select data into raw_doc from public.app_data where id = 1;
  if raw_doc is null then
    return jsonb_build_object('success', false, 'message', 'public.app_data row 1 not found.');
  end if;

  -- 1. Migrate Admin
  admin_rec := raw_doc->'admin';
  if admin_rec is not null then
    insert into public.admins (id, username, email, password_hash, two_factor_secret)
    values (
      'admin_root',
      coalesce(admin_rec->>'username', 'admin'),
      coalesce(admin_rec->>'email', 'admin@examportal.edu'),
      coalesce(admin_rec->>'passwordHash', 'admin123'),
      admin_rec->>'twoFactorSecret'
    )
    on conflict (id) do update set
      username = excluded.username,
      email = excluded.email,
      password_hash = excluded.password_hash;
  end if;

  -- 2. Migrate Batches
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'batches', '[]'::jsonb)) loop
    insert into public.batches (id, name, target_exam, description, created_at)
    values (
      item->>'id',
      item->>'name',
      coalesce(item->>'targetExam', 'ALL'),
      item->>'description',
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do update set
      name = excluded.name,
      target_exam = excluded.target_exam,
      description = excluded.description;
    c_batches := c_batches + 1;
  end loop;

  -- 3. Migrate Subjects
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'subjects', '[]'::jsonb)) loop
    insert into public.subjects (id, name, code, topics)
    values (
      item->>'id',
      item->>'name',
      item->>'code',
      coalesce(item->'topics', '[]'::jsonb)
    )
    on conflict (id) do update set
      name = excluded.name,
      code = excluded.code,
      topics = excluded.topics;
    c_subjects := c_subjects + 1;
  end loop;

  -- 4. Migrate Students
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'students', '[]'::jsonb)) loop
    insert into public.students (
      id, registration_number, full_name, email, mobile, password_hash,
      batch_id, status, rejection_reason, approved_at, profile_photo,
      date_of_birth, guardian_info, created_at
    )
    values (
      item->>'id',
      item->>'registrationNumber',
      item->>'fullName',
      item->>'email',
      coalesce(item->>'mobile', ''),
      item->>'passwordHash',
      coalesce(item->>'batchId', 'batch_all'),
      coalesce(item->>'status', 'Pending'),
      item->>'rejectionReason',
      (item->>'approvedAt')::timestamptz,
      item->>'profilePhoto',
      item->>'dateOfBirth',
      item->'guardianInfo',
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do update set
      registration_number = excluded.registration_number,
      full_name = excluded.full_name,
      email = excluded.email,
      status = excluded.status,
      approved_at = excluded.approved_at;
    c_students := c_students + 1;
  end loop;

  -- 5. Migrate Questions
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'questions', '[]'::jsonb)) loop
    insert into public.questions (
      id, text, image_url, options, correct_answer_id, explanation,
      subject, topic, subtopic, difficulty, marks, negative_marks,
      question_source, question_type, status, created_at, created_by
    )
    values (
      item->>'id',
      item->>'text',
      item->>'imageUrl',
      coalesce(item->'options', '[]'::jsonb),
      item->>'correctAnswerId',
      item->>'explanation',
      item->>'subject',
      coalesce(item->>'topic', 'General'),
      item->>'subtopic',
      coalesce(item->>'difficulty', 'Medium'),
      coalesce((item->>'marks')::numeric, 4),
      coalesce((item->>'negativeMarks')::numeric, 1),
      item->>'questionSource',
      coalesce(item->>'questionType', 'MCQ'),
      coalesce(item->>'status', 'Approved'),
      coalesce((item->>'createdAt')::timestamptz, now()),
      item->>'createdBy'
    )
    on conflict (id) do nothing;
    c_questions := c_questions + 1;
  end loop;

  -- 6. Migrate Examinations
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'examinations', '[]'::jsonb)) loop
    insert into public.examinations (
      id, name, description, subject, topics, mode, start_date, end_date,
      duration_minutes, total_marks, passing_marks, negative_marking_enabled,
      marks_per_question, negative_marks_per_question, max_attempts,
      randomize_question_order, randomize_option_order, result_release_mode,
      result_release_date, status, batch_ids, question_ids, timer_warnings,
      security, show_correct_answers_after_release, show_explanations_after_release,
      created_at
    )
    values (
      item->>'id',
      item->>'name',
      item->>'description',
      coalesce(item->>'subject', 'ALL'),
      coalesce(item->'topics', '[]'::jsonb),
      'online',
      (item->>'startDate')::timestamptz,
      (item->>'endDate')::timestamptz,
      coalesce((item->>'durationMinutes')::integer, 60),
      coalesce((item->>'totalMarks')::numeric, 100),
      coalesce((item->>'passingMarks')::numeric, 40),
      coalesce((item->>'negativeMarkingEnabled')::boolean, true),
      coalesce((item->>'marksPerQuestion')::numeric, 4),
      coalesce((item->>'negativeMarksPerQuestion')::numeric, 1),
      coalesce((item->>'maxAttempts')::integer, 1),
      coalesce((item->>'randomizeQuestionOrder')::boolean, false),
      coalesce((item->>'randomizeOptionOrder')::boolean, false),
      coalesce(item->>'resultReleaseMode', 'immediate'),
      (item->>'resultReleaseDate')::timestamptz,
      coalesce(item->>'status', 'Live'),
      coalesce(item->'batchIds', '["all"]'::jsonb),
      coalesce(item->'questionIds', '[]'::jsonb),
      coalesce(item->'timerWarnings', '{"visualWarningMinutes": 10, "prominentWarningMinutes": 5, "criticalWarningMinutes": 2}'::jsonb),
      coalesce(item->'security', '{"fullScreenRequired": false, "disableCopyPaste": true, "trackTabSwitches": true}'::jsonb),
      coalesce((item->>'showCorrectAnswersAfterRelease')::boolean, true),
      coalesce((item->>'showExplanationsAfterRelease')::boolean, true),
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do nothing;
    c_exams := c_exams + 1;
  end loop;

  -- 7. Migrate Exam Attempts
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'attempts', '[]'::jsonb)) loop
    insert into public.exam_attempts (
      id, exam_id, student_id, start_time, deadline_time, submitted_time,
      status, answers, tab_switch_count, score, max_score, percentage,
      accuracy, correct_count, incorrect_count, unanswered_count,
      negative_deductions, subject_scores, rank, percentile
    )
    values (
      item->>'id',
      item->>'examId',
      item->>'studentId',
      coalesce((item->>'startTime')::timestamptz, now()),
      coalesce((item->>'deadlineTime')::timestamptz, now() + interval '1 hour'),
      (item->>'submittedTime')::timestamptz,
      coalesce(item->>'status', 'in_progress'),
      coalesce(item->'answers', '{}'::jsonb),
      coalesce((item->>'tabSwitchCount')::integer, 0),
      coalesce((item->>'score')::numeric, 0),
      coalesce((item->>'maxScore')::numeric, 0),
      coalesce((item->>'percentage')::numeric, 0),
      coalesce((item->>'accuracy')::numeric, 0),
      coalesce((item->>'correctCount')::integer, 0),
      coalesce((item->>'incorrectCount')::integer, 0),
      coalesce((item->>'unansweredCount')::integer, 0),
      coalesce((item->>'negativeDeductions')::numeric, 0),
      coalesce(item->'subjectScores', '{}'::jsonb),
      (item->>'rank')::integer,
      (item->>'percentile')::numeric
    )
    on conflict (id) do nothing;
    c_attempts := c_attempts + 1;
  end loop;

  -- 8. Migrate Doubts
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'doubts', '[]'::jsonb)) loop
    insert into public.student_doubts (
      id, student_id, student_name, subject, title, question,
      image_url, pdf_url, status, admin_reply, admin_reply_attachment,
      replied_at, created_at
    )
    values (
      item->>'id',
      item->>'studentId',
      coalesce(item->>'studentName', 'Student'),
      item->>'subject',
      item->>'title',
      item->>'question',
      item->>'imageUrl',
      item->>'pdfUrl',
      coalesce(item->>'status', 'Pending'),
      item->>'adminReply',
      item->>'adminReplyAttachment',
      (item->>'repliedAt')::timestamptz,
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do nothing;
    c_doubts := c_doubts + 1;
  end loop;

  -- 9. Migrate Announcements
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'announcements', '[]'::jsonb)) loop
    insert into public.announcements (
      id, title, message, target_batch_id, priority, expires_at, created_at
    )
    values (
      item->>'id',
      item->>'title',
      item->>'message',
      coalesce(item->>'targetBatchId', 'all'),
      coalesce(item->>'priority', 'medium'),
      (item->>'expiresAt')::timestamptz,
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do nothing;
    c_announcements := c_announcements + 1;
  end loop;

  -- 10. Migrate Notifications
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'notifications', '[]'::jsonb)) loop
    insert into public.notifications (
      id, recipient_id, title, message, type, read, created_at
    )
    values (
      item->>'id',
      item->>'recipientId',
      item->>'title',
      item->>'message',
      coalesce(item->>'type', 'approval'),
      coalesce((item->>'read')::boolean, false),
      coalesce((item->>'createdAt')::timestamptz, now())
    )
    on conflict (id) do nothing;
    c_notifications := c_notifications + 1;
  end loop;

  -- 11. Migrate Audit Logs
  for item in select * from jsonb_array_elements(coalesce(raw_doc->'auditLogs', '[]'::jsonb)) loop
    insert into public.audit_logs (
      id, action, admin, details, target_id, timestamp
    )
    values (
      item->>'id',
      item->>'action',
      item->>'admin',
      item->>'details',
      item->>'targetId',
      coalesce((item->>'timestamp')::timestamptz, now())
    )
    on conflict (id) do nothing;
    c_logs := c_logs + 1;
  end loop;

  -- 12. Migrate Settings (without legacy music properties)
  settings_rec := raw_doc->'settings';
  if settings_rec is not null then
    -- Strip backgroundMusicEnabled, defaultMusicVolume, audioTracks
    settings_rec := settings_rec - 'backgroundMusicEnabled' - 'defaultMusicVolume' - 'audioTracks';
    insert into public.app_settings (id, data, updated_at)
    values ('platform_settings', settings_rec, now())
    on conflict (id) do update set
      data = excluded.data,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'success', true,
    'message', 'Successfully migrated all records into normalized relational tables.',
    'batches', c_batches,
    'subjects', c_subjects,
    'students', c_students,
    'questions', c_questions,
    'examinations', c_exams,
    'attempts', c_attempts,
    'doubts', c_doubts,
    'announcements', c_announcements,
    'notifications', c_notifications,
    'auditLogs', c_logs
  );
end;
$$;

grant execute on function public.migrate_app_data_to_relational() to service_role;
