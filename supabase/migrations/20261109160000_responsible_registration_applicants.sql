-- Applicant accounts can sign in after email verification without receiving permissions.
-- Their requested role remains pending until approval by the correct university authority.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student','delegate','professor','admin','applicant'));
