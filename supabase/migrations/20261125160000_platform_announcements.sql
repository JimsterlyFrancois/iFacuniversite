-- Annonces globales iFac : diffusion sécurisée par université, parcours et rôle.
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(220) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(trim(title)) BETWEEN 1 AND 220),
  CHECK (length(trim(body)) BETWEEN 1 AND 20000),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.platform_announcement_targets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id BIGINT NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  university_id BIGINT REFERENCES public.universities(id) ON DELETE CASCADE,
  faculty_id BIGINT REFERENCES public.faculties(id) ON DELETE CASCADE,
  option_id BIGINT REFERENCES public.options(id) ON DELETE CASCADE,
  study_level_id BIGINT REFERENCES public.study_levels(id) ON DELETE CASCADE,
  target_roles TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  CHECK (
    target_roles <@ ARRAY[
      'university_admin','faculty_manager','program_manager',
      'professor','student','delegate','admin_general'
    ]::TEXT[]
  ),
  CHECK (university_id IS NOT NULL OR (faculty_id IS NULL AND option_id IS NULL AND study_level_id IS NULL)),
  CHECK (faculty_id IS NOT NULL OR (option_id IS NULL AND study_level_id IS NULL)),
  CHECK (option_id IS NOT NULL OR study_level_id IS NULL)
);

CREATE INDEX IF NOT EXISTS platform_announcements_active_created_idx
  ON public.platform_announcements(is_active,created_at DESC);
CREATE INDEX IF NOT EXISTS platform_announcement_targets_scope_idx
  ON public.platform_announcement_targets(university_id,faculty_id,option_id,study_level_id);
CREATE INDEX IF NOT EXISTS platform_announcement_targets_roles_idx
  ON public.platform_announcement_targets USING GIN(target_roles);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcement_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_announcements,public.platform_announcement_targets
  FROM anon,authenticated;
