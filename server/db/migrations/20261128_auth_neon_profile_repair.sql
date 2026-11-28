-- Restore the Neon schema required by the current authentication and role model.
-- Supabase Auth remains the identity provider; Neon stores the application profile,
-- scoped role assignments, professor requests and application sessions.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.users ALTER COLUMN university_id DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN faculty_id DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN option_id DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN study_level_id DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('student','delegate','professor','admin','applicant'));
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_uidx
  ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS public.role_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL CHECK (role IN (
    'admin_general','university_admin','faculty_manager','program_manager','professor'
  )),
  university_id BIGINT REFERENCES public.universities(id),
  faculty_id BIGINT REFERENCES public.faculties(id),
  option_id BIGINT REFERENCES public.options(id),
  study_level_id BIGINT REFERENCES public.study_levels(id),
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','revoked')),
  assigned_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  CONSTRAINT role_assignments_scope_check CHECK (
    (role='admin_general' AND university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role='university_admin' AND university_id IS NOT NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role='faculty_manager' AND university_id IS NOT NULL AND faculty_id IS NOT NULL AND option_id IS NULL AND study_level_id IS NULL)
    OR (role='program_manager' AND university_id IS NOT NULL AND faculty_id IS NOT NULL AND option_id IS NOT NULL)
    OR (role='professor' AND university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS role_assignments_user_active_idx
  ON public.role_assignments(user_id,role) WHERE status='active';
CREATE INDEX IF NOT EXISTS role_assignments_scope_active_idx
  ON public.role_assignments(role,university_id,faculty_id,option_id,study_level_id) WHERE status='active';
CREATE UNIQUE INDEX IF NOT EXISTS role_assignments_global_user_role_uidx
  ON public.role_assignments(user_id,role)
  WHERE university_id IS NULL AND faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL;

CREATE TABLE IF NOT EXISTS public.courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subject_id,name),
  UNIQUE(id,subject_id)
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
  course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  requested_course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  approval_status VARCHAR(16) NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending','approved','rejected')),
  reviewed_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_requested_course_uidx
  ON public.professor_assignments(invite_id,requested_course_id)
  WHERE requested_course_id IS NOT NULL AND approval_status IN ('pending','approved');
CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_course_uidx
  ON public.professor_assignments(invite_id,course_id) WHERE course_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS professor_assignments_review_queue_idx
  ON public.professor_assignments(university_id,faculty_id,option_id,study_level_id,approval_status,created_at DESC);
CREATE INDEX IF NOT EXISTS professor_assignments_course_active_idx
  ON public.professor_assignments(course_id,is_active);
