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
