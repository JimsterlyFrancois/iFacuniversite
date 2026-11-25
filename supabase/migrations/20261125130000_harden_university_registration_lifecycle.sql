-- An active university may be prepared before it is ready for student enrollment.
-- Manager and professor requests use the active-university catalogue independently.
ALTER TABLE public.universities
  ALTER COLUMN registration_enabled SET DEFAULT FALSE;

-- Close only institutions that currently have no complete active academic path.
-- Existing accounts, assignments and historical academic records are preserved.
UPDATE public.universities u
SET registration_enabled = FALSE,
    updated_at = NOW()
WHERE u.registration_enabled = TRUE
  AND (
    u.is_active IS NOT TRUE
    OR NOT EXISTS (
      SELECT 1
      FROM public.role_assignments ra
      JOIN public.users administrator
        ON administrator.id = ra.user_id
       AND administrator.is_active = TRUE
      WHERE ra.university_id = u.id
        AND ra.role = 'university_admin'
        AND ra.status = 'active'
    )
    OR NOT EXISTS (
    SELECT 1
    FROM public.faculties f
    JOIN public.options o ON o.faculty_id = f.id
    JOIN public.study_levels l ON l.option_id = o.id
    WHERE f.university_id = u.id
      AND f.is_active = TRUE
      AND o.is_active = TRUE
      AND l.is_active = TRUE
    )
  );
