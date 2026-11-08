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
