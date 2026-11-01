-- iFac universite — messagerie privée des délégués vers l'administration
-- Exécuter une seule fois dans Supabase SQL Editor si le serveur ne l'a pas encore créée.
CREATE TABLE IF NOT EXISTS delegate_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  subject VARCHAR(220) NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS delegate_messages_university_created_idx
  ON delegate_messages (university_id, created_at DESC);
