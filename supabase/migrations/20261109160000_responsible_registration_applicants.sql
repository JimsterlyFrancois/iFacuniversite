-- Registered managers remain applicants until a scoped role is approved.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student','delegate','professor','admin','applicant'));

-- A professor can request the same study year in more than one academic program.
ALTER TABLE public.professor_assignments
  DROP CONSTRAINT IF EXISTS professor_assignments_invite_id_study_level_id_key;
DROP INDEX IF EXISTS public.professor_assignments_legacy_scope_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS professor_assignments_legacy_scope_uidx
  ON public.professor_assignments(invite_id, university_id, faculty_id, option_id, study_level_id)
  WHERE course_id IS NULL;
