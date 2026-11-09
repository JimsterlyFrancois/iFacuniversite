-- Link application profiles to Supabase Auth identities so password recovery
-- updates the credential that Supabase Auth actually verifies.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_uidx
  ON public.users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_auth_user_id_fkey
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.users AS u
SET auth_user_id = au.id
FROM auth.users AS au
WHERE u.auth_user_id IS NULL
  AND lower(u.email) = lower(au.email);
