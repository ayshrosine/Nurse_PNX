-- Nursing Level Up — PostgreSQL schema (spec: specs/02-database.md)
-- Idempotent: safe to run against an empty database. Use `npm run db:reset` to drop and recreate.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('STUDENT', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE test_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE answer_option AS ENUM ('A', 'B', 'C', 'D');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE question_review_status AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE question_source AS ENUM ('MANUAL', 'IMPORTED', 'AI_GENERATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('RAZORPAY', 'STRIPE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE purchase_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE attempt_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE document_file_type AS ENUM ('PDF', 'DOCX', 'HTML');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'UPLOADED', 'EXTRACTING', 'EXTRACTED', 'EXTRACT_FAILED',
    'GENERATING', 'GENERATED', 'GENERATE_FAILED', 'APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id      TEXT UNIQUE,
  name           TEXT NOT NULL,
  email          CITEXT NOT NULL UNIQUE,
  phone          TEXT,
  role           user_role NOT NULL DEFAULT 'STUDENT',
  status         user_status NOT NULL DEFAULT 'ACTIVE',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ,
  CONSTRAINT chk_phone_format CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{7,15}$')
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------------------------------------------------------------- test_series
CREATE TABLE IF NOT EXISTS test_series (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency          TEXT NOT NULL DEFAULT 'INR',
  is_free           BOOLEAN NOT NULL DEFAULT true,
  duration_minutes  INTEGER NOT NULL CHECK (duration_minutes > 0),
  status            test_status NOT NULL DEFAULT 'DRAFT',
  instructions      TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ,
  CONSTRAINT chk_free_price CHECK (NOT is_free OR price = 0),
  CONSTRAINT chk_paid_price CHECK (is_free OR price > 0)
);
CREATE INDEX IF NOT EXISTS idx_test_series_status ON test_series (status);

-- ---------------------------------------------------------------- documents
-- Created before questions because questions.source_document_id references it.
CREATE TABLE IF NOT EXISTS documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id      UUID REFERENCES test_series(id) ON DELETE SET NULL,
  uploaded_by         UUID NOT NULL REFERENCES users(id),
  original_filename   TEXT NOT NULL,
  file_type           document_file_type NOT NULL,
  mime_type           TEXT NOT NULL,
  size_bytes          INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  storage_key         TEXT NOT NULL,
  storage_url         TEXT,
  status              document_status NOT NULL DEFAULT 'UPLOADED',
  extracted_text_key  TEXT,
  ocr_provider        TEXT,
  ai_provider         TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_test_series_id ON documents (test_series_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents (uploaded_by);

-- ---------------------------------------------------------------- questions
CREATE TABLE IF NOT EXISTS questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_series_id      UUID NOT NULL REFERENCES test_series(id) ON DELETE CASCADE,
  question_text       TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
  option_a            TEXT NOT NULL CHECK (length(trim(option_a)) > 0),
  option_b            TEXT NOT NULL CHECK (length(trim(option_b)) > 0),
  option_c            TEXT NOT NULL CHECK (length(trim(option_c)) > 0),
  option_d            TEXT NOT NULL CHECK (length(trim(option_d)) > 0),
  correct_answer      answer_option NOT NULL,
  explanation         TEXT,
  question_order      INTEGER NOT NULL,
  source              question_source NOT NULL DEFAULT 'MANUAL',
  source_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  review_status       question_review_status NOT NULL DEFAULT 'APPROVED',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DEFERRABLE so reordering can swap positions inside one transaction.
  CONSTRAINT uq_question_order UNIQUE (test_series_id, question_order) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS idx_questions_test_series_id ON questions (test_series_id);
CREATE INDEX IF NOT EXISTS idx_questions_review_status ON questions (review_status);
CREATE INDEX IF NOT EXISTS idx_questions_source_document_id ON questions (source_document_id);

-- ---------------------------------------------------------------- purchases
CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  test_series_id  UUID NOT NULL REFERENCES test_series(id) ON DELETE RESTRICT,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency        TEXT NOT NULL DEFAULT 'INR',
  provider        payment_provider NOT NULL DEFAULT 'RAZORPAY',
  order_id        TEXT NOT NULL,
  payment_id      TEXT,
  status          purchase_status NOT NULL DEFAULT 'PENDING',
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_test_series_id ON purchases (test_series_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_order_id ON purchases (order_id);
-- Access check: EXISTS (user_id, test_series_id, status='SUCCESS'). Deliberately not UNIQUE — if a student is
-- ever charged twice, both payments must be recorded truthfully so an admin can refund the duplicate.
CREATE INDEX IF NOT EXISTS idx_purchases_access ON purchases (user_id, test_series_id, status);

-- ---------------------------------------------------------------- attempts
CREATE TABLE IF NOT EXISTS attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  test_series_id      UUID NOT NULL REFERENCES test_series(id) ON DELETE RESTRICT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  score               INTEGER,
  total_questions     INTEGER NOT NULL,
  correct_answers     INTEGER,
  incorrect_answers   INTEGER,
  unanswered          INTEGER,
  percentage          NUMERIC(5,2),
  time_taken_seconds  INTEGER,
  status              attempt_status NOT NULL DEFAULT 'IN_PROGRESS',
  -- Question ids served for this attempt, in order. Scoring uses exactly this set,
  -- so later edits to the series cannot change what this attempt is graded against.
  question_ids        UUID[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_test_series_id ON attempts (test_series_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts (status);

-- ---------------------------------------------------------------- user_answers
CREATE TABLE IF NOT EXISTS user_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id      UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_answer  answer_option,
  is_correct       BOOLEAN,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt_id ON user_answers (attempt_id);

-- ---------------------------------------------------------------- platform_settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES
  ('ocr_provider', 'tesseract'),
  ('ai_provider', 'gemini'),
  ('mcq_default_count', '20')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs (admin_id);

-- ---------------------------------------------------------------- payment_events
-- Every verified Razorpay webhook is recorded once (idempotency + audit trail).
CREATE TABLE IF NOT EXISTS payment_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     payment_provider NOT NULL,
  event_id     TEXT NOT NULL UNIQUE,
  event_type   TEXT NOT NULL,
  order_id     TEXT,
  payment_id   TEXT,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- triggers
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','test_series','documents','questions','purchases'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
