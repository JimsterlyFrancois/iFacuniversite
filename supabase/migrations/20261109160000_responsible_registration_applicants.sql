-- Applicant accounts can sign in after email verification without receiving permissions.
-- Their requested role remains pending until approval by the correct university authority.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student','delegate','professor','admin','applicant'));


-- A professor can submit independent course applications across universities and programs.
ALTER TABLE public.professor_assignments
  ADD COLUMN IF NOT EXISTS requested_course_id BIGINT REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

ALTER TABLE public.professor_assignments
  DROP CONSTRAINT IF EXISTS professor_assignments_approval_status_check;
ALTER TABLE public.professor_assignments
  ADD CONSTRAINT professor_assignments_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

-- Existing completed assignments remain approved; older unassigned rows become reviewable requests.
UPDATE public.professor_assignments
SET approval_status = CASE WHEN course_id IS NULL THEN 'pending' ELSE 'approved' END
WHERE approval_status='approved';

-- The former one-row-per-level index prevented multiple course requests for the same level.
DROP INDEX IF EXISTS public.professor_assignments_legacy_scope_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_requested_course_uidx
  ON public.professor_assignments(invite_id,requested_course_id)
  WHERE requested_course_id IS NOT NULL AND approval_status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS professor_assignments_review_queue_idx
  ON public.professor_assignments(university_id,faculty_id,option_id,study_level_id,approval_status,created_at DESC);


-- Derive the single professor workspace permission from independent course requests.
UPDATE public.role_assignments ra
SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.professor_invites i
        JOIN public.professor_assignments pa ON pa.invite_id=i.id
        WHERE i.user_id=ra.user_id AND i.is_active=TRUE AND pa.is_active=TRUE
          AND pa.approval_status='approved' AND pa.course_id IS NOT NULL
      ) THEN 'active'
      WHEN EXISTS (
        SELECT 1 FROM public.professor_invites i
        JOIN public.professor_assignments pa ON pa.invite_id=i.id
        WHERE i.user_id=ra.user_id AND i.is_active=TRUE AND pa.is_active=TRUE
          AND pa.approval_status='pending'
      ) THEN 'pending'
      ELSE 'revoked'
    END,
    revoked_at = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.professor_invites i
        JOIN public.professor_assignments pa ON pa.invite_id=i.id
        WHERE i.user_id=ra.user_id AND i.is_active=TRUE AND pa.is_active=TRUE
          AND pa.approval_status IN ('approved','pending')
      ) THEN NULL ELSE NOW()
    END,
    updated_at=NOW()
WHERE ra.role='professor';
