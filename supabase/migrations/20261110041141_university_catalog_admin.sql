-- Academic catalogue administration by university administrators.
-- New institutions remain unavailable to student registration until their catalogue is ready.
ALTER TABLE public.universities
  ADD COLUMN IF NOT EXISTS registration_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.universities.registration_enabled IS
  'Controls public student registration independently from administrative access.';

CREATE INDEX IF NOT EXISTS universities_registration_enabled_idx
  ON public.universities(is_active, registration_enabled, name);
