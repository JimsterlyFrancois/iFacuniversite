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
