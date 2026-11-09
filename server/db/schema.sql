-- iFac universite — schéma PostgreSQL initial
-- Les catalogues restent vides jusqu'à validation des données officielles UPNCH.
-- Les mots de passe doivent être stockés uniquement sous forme de hash robuste.

CREATE TABLE universities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, code),
  UNIQUE (university_id, name)
);

CREATE TABLE options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, code),
  UNIQUE (faculty_id, name)
);

CREATE TABLE study_levels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_id BIGINT NOT NULL REFERENCES options(id),
  code VARCHAR(16) NOT NULL,
  label VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (option_id, code),
  UNIQUE (option_id, sort_order)
);

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'delegate', 'professor', 'admin')),
  email_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);
CREATE INDEX users_profile_idx ON users (university_id, faculty_id, option_id, study_level_id);

CREATE TABLE sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE email_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_level_id, name)
);

CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subjects(id),
  title VARCHAR(220) NOT NULL,
  file_key TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by BIGINT REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX documents_subject_active_idx ON documents (subject_id, is_active);

CREATE TABLE personal_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX personal_notes_owner_idx ON personal_notes (user_id, updated_at DESC);

CREATE TABLE announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT REFERENCES faculties(id),
  option_id BIGINT REFERENCES options(id),
  study_level_id BIGINT REFERENCES study_levels(id),
  title VARCHAR(220) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX announcements_audience_idx ON announcements (university_id, faculty_id, option_id, study_level_id, is_active);

CREATE TABLE message_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT REFERENCES faculties(id),
  option_id BIGINT REFERENCES options(id),
  study_level_id BIGINT REFERENCES study_levels(id),
  group_type VARCHAR(16) NOT NULL CHECK (group_type IN ('faculty', 'option', 'class')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id BIGINT NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_group_created_idx ON messages (group_id, created_at DESC);

CREATE TABLE feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('suggestion', 'question', 'rating')),
  message TEXT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IMPORTANT: toutes les opérations d'accès doivent être contrôlées par l'API.
-- Les identifiants de profil reçus du navigateur doivent être revalidés ensemble
-- (université, faculté, option, niveau) avant la création ou la modification d'un compte.


-- Messages privés envoyés par les délégués à l'administration de leur université.
CREATE TABLE IF NOT EXISTS delegate_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  subject VARCHAR(220) NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS delegate_messages_university_created_idx ON delegate_messages (university_id, created_at DESC);


ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_key TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(80);

-- Compatibility objects used by the current class-document and professor APIs.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS university_id BIGINT REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS faculty_id BIGINT REFERENCES public.faculties(id),
  ADD COLUMN IF NOT EXISTS option_id BIGINT REFERENCES public.options(id),
  ADD COLUMN IF NOT EXISTS study_level_id BIGINT REFERENCES public.study_levels(id),
  ADD COLUMN IF NOT EXISTS course VARCHAR(180),
  ADD COLUMN IF NOT EXISTS professor VARCHAR(180),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  UNIQUE(user_id, document_id)
);

CREATE TABLE IF NOT EXISTS public.professor_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  created_by BIGINT REFERENCES public.users(id),
  user_id BIGINT UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.professor_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invite_id BIGINT NOT NULL REFERENCES public.professor_invites(id) ON DELETE CASCADE,
  university_id BIGINT NOT NULL REFERENCES public.universities(id),
  faculty_id BIGINT NOT NULL REFERENCES public.faculties(id),
  option_id BIGINT NOT NULL REFERENCES public.options(id),
  study_level_id BIGINT NOT NULL REFERENCES public.study_levels(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invite_id, study_level_id)
);


-- Scoped roles and publication tables (same additive DDL as the Supabase migration).
-- iFac Université: scoped roles, academic courses and controlled publication.
-- Additive migration: preserves existing users, invitations, assignments and documents.

-- Pending professors and the global administrator do not need a student academic profile.
ALTER TABLE public.users
  ALTER COLUMN university_id DROP NOT NULL,
  ALTER COLUMN faculty_id DROP NOT NULL,
  ALTER COLUMN option_id DROP NOT NULL,
  ALTER COLUMN study_level_id DROP NOT NULL;

-- A user's login identity remains in users; permissions are separate, scoped assignments.
CREATE TABLE IF NOT EXISTS public.role_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK (role IN (
    'admin_general', 'university_admin', 'faculty_manager',
    'program_manager', 'professor'
  )),
  university_id BIGINT REFERENCES public.universities(id),
  faculty_id BIGINT REFERENCES public.faculties(id),
  option_id BIGINT REFERENCES public.options(id),
  study_level_id BIGINT REFERENCES public.study_levels(id),
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  assigned_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT role_assignments_scope_check CHECK (
    (role = 'admin_general' AND university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role = 'university_admin' AND university_id IS NOT NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role = 'faculty_manager' AND university_id IS NOT NULL AND faculty_id IS NOT NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role = 'program_manager' AND university_id IS NOT NULL AND faculty_id IS NOT NULL AND option_id IS NOT NULL)
    OR (role = 'professor' AND university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS role_assignments_user_active_idx
  ON public.role_assignments(user_id, role) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS role_assignments_scope_active_idx
  ON public.role_assignments(role, university_id, faculty_id, option_id, study_level_id)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_global_user_role_uidx
  ON public.role_assignments(user_id, role)
  WHERE university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL;

-- Preserve the existing professor invitation workflow while allowing assignments to courses.
CREATE TABLE IF NOT EXISTS public.courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id, name),
  UNIQUE(id, subject_id)
);

-- Ensure legacy professor tables exist when this migration is run on a clean bootstrap database.
CREATE TABLE IF NOT EXISTS public.professor_invites (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  created_by BIGINT REFERENCES public.users(id),
  user_id BIGINT UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.professor_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invite_id BIGINT NOT NULL REFERENCES public.professor_invites(id) ON DELETE CASCADE,
  university_id BIGINT NOT NULL REFERENCES public.universities(id),
  faculty_id BIGINT NOT NULL REFERENCES public.faculties(id),
  option_id BIGINT NOT NULL REFERENCES public.options(id),
  study_level_id BIGINT NOT NULL REFERENCES public.study_levels(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invite_id, study_level_id)
);

ALTER TABLE public.professor_assignments
  ADD COLUMN IF NOT EXISTS course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS assigned_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.professor_assignments
  DROP CONSTRAINT IF EXISTS professor_assignments_invite_id_study_level_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_legacy_scope_uidx
  ON public.professor_assignments(invite_id, study_level_id)
  WHERE course_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_course_uidx
  ON public.professor_assignments(invite_id, course_id)
  WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS professor_assignments_course_active_idx
  ON public.professor_assignments(course_id, is_active);

-- Extend the existing document record instead of moving or deleting stored files.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publication_scope VARCHAR(16) NOT NULL DEFAULT 'class',
  ADD COLUMN IF NOT EXISTS published_by_role VARCHAR(32);

-- Complete the scope of legacy documents from their existing subject relation.
UPDATE public.documents d
SET university_id = COALESCE(d.university_id, u.id),
    faculty_id = COALESCE(d.faculty_id, f.id),
    option_id = COALESCE(d.option_id, o.id),
    study_level_id = COALESCE(d.study_level_id, s.study_level_id)
FROM public.subjects s
JOIN public.options o ON o.id = s.option_id
JOIN public.faculties f ON f.id = o.faculty_id
JOIN public.universities u ON u.id = f.university_id
WHERE d.subject_id = s.id
  AND (d.university_id IS NULL OR d.faculty_id IS NULL OR d.option_id IS NULL OR d.study_level_id IS NULL);

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_publication_scope_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_publication_scope_check
  CHECK (publication_scope IN ('global', 'university', 'faculty', 'program', 'class', 'course'));

-- Existing subject-based resources remain class-scoped unless explicitly changed by an authorized publisher.
UPDATE public.documents
SET publication_scope = CASE
  WHEN course_id IS NOT NULL THEN 'course'
  WHEN study_level_id IS NOT NULL THEN 'class'
  WHEN option_id IS NOT NULL THEN 'program'
  WHEN faculty_id IS NOT NULL THEN 'faculty'
  WHEN university_id IS NOT NULL THEN 'university'
  ELSE 'global'
END
WHERE publication_scope = 'class';

CREATE INDEX IF NOT EXISTS documents_publication_scope_idx
  ON public.documents(publication_scope, university_id, faculty_id, option_id, study_level_id, created_at DESC)
  WHERE is_active = TRUE;

-- Audit trail for publication and role-management operations.
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id BIGINT,
  university_id BIGINT REFERENCES public.universities(id),
  faculty_id BIGINT REFERENCES public.faculties(id),
  option_id BIGINT REFERENCES public.options(id),
  study_level_id BIGINT REFERENCES public.study_levels(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_scope_created_idx
  ON public.admin_audit_logs(university_id, faculty_id, option_id, created_at DESC);

-- Enforce the academic hierarchy and appointment limits in the database, not only in the UI.
CREATE OR REPLACE FUNCTION public.validate_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  scope_is_valid BOOLEAN;
  current_count INTEGER;
  lock_key BIGINT;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin_general' THEN
    lock_key := hashtextextended('role-limit:admin_general', 0);
    PERFORM pg_advisory_xact_lock(lock_key);
    SELECT COUNT(*) INTO current_count
    FROM public.role_assignments
    WHERE role = NEW.role AND status = 'active' AND id <> COALESCE(NEW.id, -1);
    IF current_count >= 1 THEN
      RAISE EXCEPTION 'role_assignment_limit_reached:admin_general' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role = 'professor' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.universities u
    LEFT JOIN public.faculties f ON f.id = NEW.faculty_id AND f.university_id = u.id
    LEFT JOIN public.options o ON o.id = NEW.option_id AND o.faculty_id = f.id
    LEFT JOIN public.study_levels l ON l.id = NEW.study_level_id AND l.option_id = o.id
    WHERE u.id = NEW.university_id AND u.is_active = TRUE
      AND (NEW.faculty_id IS NULL OR f.id IS NOT NULL)
      AND (NEW.option_id IS NULL OR o.id IS NOT NULL)
      AND (NEW.study_level_id IS NULL OR l.id IS NOT NULL)
  ) INTO scope_is_valid;

  IF NOT scope_is_valid THEN
    RAISE EXCEPTION 'invalid_role_assignment_scope' USING ERRCODE = '23514';
  END IF;

  IF NEW.role IN ('university_admin', 'faculty_manager') THEN
    lock_key := hashtextextended(
      'role-limit:' || NEW.role || ':' ||
      NEW.university_id::text || ':' || COALESCE(NEW.faculty_id::text, ''),
      0
    );
    PERFORM pg_advisory_xact_lock(lock_key);
    IF NEW.role = 'university_admin' THEN
      SELECT COUNT(*) INTO current_count
      FROM public.role_assignments
      WHERE role = NEW.role AND university_id = NEW.university_id
        AND status = 'active' AND id <> COALESCE(NEW.id, -1);
      IF current_count >= 2 THEN
        RAISE EXCEPTION 'role_assignment_limit_reached:university_admin' USING ERRCODE = '23514';
      END IF;
    ELSE
      SELECT COUNT(*) INTO current_count
      FROM public.role_assignments
      WHERE role = NEW.role AND university_id = NEW.university_id
        AND faculty_id = NEW.faculty_id
        AND status = 'active' AND id <> COALESCE(NEW.id, -1);
      IF current_count >= 4 THEN
        RAISE EXCEPTION 'role_assignment_limit_reached:faculty_manager' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS role_assignments_validate_scope ON public.role_assignments;
CREATE TRIGGER role_assignments_validate_scope
BEFORE INSERT OR UPDATE OF role, status, university_id, faculty_id, option_id, study_level_id
ON public.role_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_role_assignment();

-- Backfill only identities already designated by the existing application.
INSERT INTO public.role_assignments(user_id, role, status, created_at, updated_at)
SELECT u.id, 'admin_general', 'active', NOW(), NOW()
FROM public.users u
WHERE u.role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_assignments(user_id, role, status, created_at, updated_at)
SELECT i.user_id, 'professor',
       CASE WHEN EXISTS (
         SELECT 1 FROM public.professor_assignments pa
         WHERE pa.invite_id = i.id AND pa.is_active = TRUE
       ) THEN 'active' ELSE 'pending' END,
       NOW(), NOW()
FROM public.professor_invites i
WHERE i.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Keep the new internal tables inaccessible through the public Data API.
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.role_assignments, public.courses, public.admin_audit_logs
  FROM anon, authenticated;

-- Scoped publication hardening.
-- Harden the role-assignment trigger and index the new foreign-key paths.
ALTER FUNCTION public.validate_role_assignment() SET search_path = pg_catalog;

CREATE INDEX IF NOT EXISTS courses_created_by_idx
  ON public.courses(created_by);
CREATE INDEX IF NOT EXISTS documents_course_id_idx
  ON public.documents(course_id);
CREATE INDEX IF NOT EXISTS professor_assignments_assigned_by_idx
  ON public.professor_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS role_assignments_assigned_by_idx
  ON public.role_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS role_assignments_approved_by_idx
  ON public.role_assignments(approved_by);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_user_idx
  ON public.admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_faculty_idx
  ON public.admin_audit_logs(faculty_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_option_idx
  ON public.admin_audit_logs(option_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_study_level_idx
  ON public.admin_audit_logs(study_level_id);

-- Document storage bucket separation.
-- Distinguish the private bucket used by each document route.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(80) NOT NULL DEFAULT 'ifac-documents';

UPDATE public.documents
SET storage_bucket = CASE
  WHEN file_name IS NOT NULL AND course IS NOT NULL THEN 'class-documents'
  ELSE 'ifac-documents'
END;

CREATE INDEX IF NOT EXISTS documents_storage_bucket_scope_idx
  ON public.documents(storage_bucket, publication_scope, university_id, faculty_id, option_id, study_level_id)
  WHERE is_active = TRUE;



-- SaaS administration and manual billing foundation (also in Supabase migration).
-- iFac Université: SaaS administration and manual billing foundation.
-- Apply this migration before deploying the general administrator workspace.

CREATE TABLE IF NOT EXISTS public.saas_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval VARCHAR(16) NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','yearly','one_time')),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.university_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  plan_id BIGINT NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','suspended','canceled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  external_customer_id VARCHAR(180),
  notes TEXT,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS university_subscriptions_university_status_idx
  ON public.university_subscriptions(university_id,status,created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS university_subscriptions_one_current_idx
  ON public.university_subscriptions(university_id)
  WHERE status IN ('trialing','active','past_due','suspended');

CREATE TABLE IF NOT EXISTS public.billing_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subscription_id BIGINT REFERENCES public.university_subscriptions(id) ON DELETE SET NULL,
  university_id BIGINT NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(48) NOT NULL UNIQUE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(16) NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','paid','overdue','void')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference VARCHAR(180),
  notes TEXT,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_at IS NULL OR due_at >= issued_at)
);
CREATE INDEX IF NOT EXISTS billing_records_university_status_idx
  ON public.billing_records(university_id,status,issued_at DESC);

INSERT INTO public.saas_plans(code,name,description,amount_cents,currency,billing_interval,limits)
VALUES
 ('starter','Starter','Offre de démarrage à configurer',0,'USD','monthly',
  '{"universities":1,"students":250,"storage_gb":2,"support":"standard"}'::jsonb),
 ('campus','Campus','Offre campus à configurer',0,'USD','monthly',
  '{"universities":1,"students":1500,"storage_gb":20,"support":"priority"}'::jsonb),
 ('institution','Institution','Offre institutionnelle à configurer',0,'USD','yearly',
  '{"universities":5,"students":10000,"storage_gb":100,"support":"priority"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saas_plans, public.university_subscriptions, public.billing_records
  FROM anon, authenticated;
