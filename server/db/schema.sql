-- iFac universite — schéma PostgreSQL initial
-- Les catalogues restent vides jusqu'à validation des données officielles UPNCH.
-- Les mots de passe doivent être stockés uniquement sous forme de hash robuste.

CREATE TABLE universities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faculties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, code),
  UNIQUE (university_id, name)
);

CREATE TABLE options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  code VARCHAR(32) NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, code),
  UNIQUE (faculty_id, name)
);

CREATE TABLE study_levels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_id BIGINT NOT NULL REFERENCES options(id),
  code VARCHAR(16) NOT NULL,
  label VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (option_id, code),
  UNIQUE (option_id, sort_order)
);

CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT NOT NULL REFERENCES faculties(id),
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'delegate', 'professor', 'admin')),
  email_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);
CREATE INDEX users_profile_idx ON users (university_id, faculty_id, option_id, study_level_id);

CREATE TABLE email_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subjects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  option_id BIGINT NOT NULL REFERENCES options(id),
  study_level_id BIGINT NOT NULL REFERENCES study_levels(id),
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (study_level_id, name)
);

CREATE TABLE documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_id BIGINT NOT NULL REFERENCES subjects(id),
  title VARCHAR(220) NOT NULL,
  file_key TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by BIGINT REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX documents_subject_active_idx ON documents (subject_id, is_active);

CREATE TABLE personal_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX personal_notes_owner_idx ON personal_notes (user_id, updated_at DESC);

CREATE TABLE announcements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT REFERENCES faculties(id),
  option_id BIGINT REFERENCES options(id),
  study_level_id BIGINT REFERENCES study_levels(id),
  title VARCHAR(220) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX announcements_audience_idx ON announcements (university_id, faculty_id, option_id, study_level_id, is_active);

CREATE TABLE message_groups (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  university_id BIGINT NOT NULL REFERENCES universities(id),
  faculty_id BIGINT REFERENCES faculties(id),
  option_id BIGINT REFERENCES options(id),
  study_level_id BIGINT REFERENCES study_levels(id),
  group_type VARCHAR(16) NOT NULL CHECK (group_type IN ('faculty', 'option', 'class')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id BIGINT NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES message_groups(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_group_created_idx ON messages (group_id, created_at DESC);

CREATE TABLE feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN ('suggestion', 'question', 'rating')),
  message TEXT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IMPORTANT: toutes les opérations d'accès doivent être contrôlées par l'API.
-- Les identifiants de profil reçus du navigateur doivent être revalidés ensemble
-- (université, faculté, option, niveau) avant la création ou la modification d'un compte.
