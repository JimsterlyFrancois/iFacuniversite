-- Store the external Auth identity on the application profile.
-- Auth remains a separate service; the application database does not depend
-- on the Auth provider's private PostgreSQL schema.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_uidx
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;
