-- Migration: Taxonomy, Question Bank, Products, Daily Quiz, Bookmarks, Notes
-- Extends the base schema (db/schema.sql) with the SDLC-specified features.

-- ================================================================ TAXONOMY
-- Programs: BSC_NURSING, GNM, NORCET, ESIC, RRB, CHO, STATE_CET
CREATE TABLE IF NOT EXISTS programs (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code  TEXT NOT NULL UNIQUE,
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE,
  description TEXT,
  icon  TEXT,            -- emoji or icon key
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS semesters (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT NOT NULL,
  label  TEXT NOT NULL,
  UNIQUE(number)
);

CREATE TABLE IF NOT EXISTS program_semesters (
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, semester_id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL,
  slug  TEXT NOT NULL UNIQUE,
  icon  TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS program_subjects (
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL,
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_program_subjects_semester ON program_subjects(semester_id);

CREATE TABLE IF NOT EXISTS topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES topics(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subject_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);

-- ================================================================ EXAM PAPERS (PYQ)
CREATE TABLE IF NOT EXISTS exam_papers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     UUID NOT NULL REFERENCES programs(id),
  exam_name      TEXT NOT NULL,
  exam_year      INT NOT NULL,
  shift          TEXT,
  source_type    TEXT,
  source_note    TEXT,
  total_questions INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_name, exam_year, shift)
);
CREATE INDEX IF NOT EXISTS idx_exam_papers_program ON exam_papers(program_id);

-- ================================================================ EXTEND QUESTIONS
-- Add taxonomy columns to the existing questions table.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty SMALLINT CHECK (difficulty IS NULL OR (difficulty >= 1 AND difficulty <= 3));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS exam_paper_id UUID REFERENCES exam_papers(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS paper_qno INT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON questions(subject_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_paper ON questions(exam_paper_id);

-- ================================================================ MANY-TO-MANY: TEST ↔ QUESTIONS
CREATE TABLE IF NOT EXISTS test_series_questions (
  test_series_id UUID NOT NULL REFERENCES test_series(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  position       INT NOT NULL,
  PRIMARY KEY (test_series_id, question_id)
);

-- ================================================================ EXTEND TEST_SERIES
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS test_type TEXT;
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id);
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id);
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id);
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS negative_marking NUMERIC DEFAULT 0;
ALTER TABLE test_series ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE INDEX IF NOT EXISTS idx_test_series_program ON test_series(program_id);
CREATE INDEX IF NOT EXISTS idx_test_series_subject ON test_series(subject_id);
CREATE INDEX IF NOT EXISTS idx_test_series_type ON test_series(test_type);

-- ================================================================ PRODUCTS & COMMERCE
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('SINGLE_TEST', 'BUNDLE', 'NOTES', 'PACK')),
  slug        TEXT UNIQUE,
  description TEXT,
  price_paise INT NOT NULL CHECK (price_paise >= 0),
  mrp_paise   INT NOT NULL CHECK (mrp_paise >= 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  features    TEXT[],
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  test_series_id UUID REFERENCES test_series(id),
  resource_id   UUID
);
CREATE INDEX IF NOT EXISTS idx_product_items_product ON product_items(product_id);

CREATE TABLE IF NOT EXISTS entitlements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  product_id        UUID NOT NULL REFERENCES products(id),
  source_purchase_id UUID,
  granted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ,
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id);

CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  description TEXT,
  percent_off INT NOT NULL CHECK (percent_off > 0 AND percent_off <= 100),
  max_uses    INT,
  used        INT NOT NULL DEFAULT 0,
  valid_from  TIMESTAMPTZ DEFAULT now(),
  valid_till  TIMESTAMPTZ,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================ RESOURCES (NOTES PDFs)
CREATE TABLE IF NOT EXISTS resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  subject_id  UUID REFERENCES subjects(id),
  storage_key TEXT NOT NULL,
  file_type   TEXT NOT NULL DEFAULT 'PDF',
  size_bytes  INT,
  is_free     BOOLEAN NOT NULL DEFAULT false,
  download_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_subject ON resources(subject_id);

-- ================================================================ BOOKMARKS
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- ================================================================ DAILY QUIZ
CREATE TABLE IF NOT EXISTS daily_quizzes (
  quiz_date      DATE PRIMARY KEY,
  test_series_id UUID REFERENCES test_series(id),
  subject_id     UUID REFERENCES subjects(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================ USER TOPIC STATS
CREATE TABLE IF NOT EXISTS user_topic_stats (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id  UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  attempted INT NOT NULL DEFAULT 0,
  correct   INT NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, topic_id)
);

-- ================================================================ LEADS (link-in-bio funnel)
CREATE TABLE IF NOT EXISTS leads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT,
  phone      TEXT,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================ TRIGGERS for updated_at on new tables
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

-- ================================================================ SEED DATA: Programs
INSERT INTO programs (code, name, slug, icon, sort_order) VALUES
  ('NORCET',    'AIIMS NORCET',              'norcet',     '🏥', 1),
  ('ESIC',      'ESIC Nursing Officer',      'esic',       '🏛️', 2),
  ('RRB',       'RRB Staff Nurse',           'rrb',        '🚂', 3),
  ('CHO',       'State CHO',                 'cho',        '🩺', 4),
  ('STATE_CET', 'State CET / Entrance',      'state-cet',  '📝', 5),
  ('BSC_NURSING', 'B.Sc. Nursing',           'bsc-nursing','🎓', 6),
  ('GNM',       'GNM',                       'gnm',        '📚', 7)
ON CONFLICT (code) DO NOTHING;

-- Seed: Core Subjects
INSERT INTO subjects (name, slug, icon, sort_order) VALUES
  ('Medical-Surgical Nursing (MSN)',  'msn',           '❤️', 1),
  ('Pharmacology',                     'pharmacology',  '💊', 2),
  ('Fundamentals of Nursing (FON)',    'fon',           '📖', 3),
  ('Community Health Nursing',         'community-health', '🏘️', 4),
  ('Pediatric Nursing',               'pediatric',     '👶', 5),
  ('Obstetric & Gynecological Nursing','obg',           '🤰', 6),
  ('Psychiatric Nursing',             'psychiatric',   '🧠', 7),
  ('Microbiology',                     'microbiology',  '🦠', 8),
  ('Anatomy & Physiology',            'anatomy',       '🫀', 9),
  ('Nutrition & Biochemistry',        'nutrition',     '🥗', 10)
ON CONFLICT (slug) DO NOTHING;

-- Seed: Semesters
INSERT INTO semesters (number, label) VALUES
  (1, 'Semester 1'), (2, 'Semester 2'), (3, 'Semester 3'), (4, 'Semester 4'),
  (5, 'Semester 5'), (6, 'Semester 6'), (7, 'Semester 7'), (8, 'Semester 8')
ON CONFLICT (number) DO NOTHING;

-- Seed: Sample Topics for MSN
INSERT INTO topics (subject_id, name, slug, sort_order)
SELECT s.id, t.name, t.slug, t.sort_order
FROM subjects s,
     (VALUES ('Cardiovascular Nursing', 'cardiovascular', 1),
             ('Respiratory Nursing', 'respiratory', 2),
             ('Renal Nursing', 'renal', 3),
             ('Neurological Nursing', 'neurological', 4),
             ('Endocrine Nursing', 'endocrine', 5),
             ('GI Nursing', 'gi-nursing', 6),
             ('Hematological Nursing', 'hematological', 7)
     ) AS t(name, slug, sort_order)
WHERE s.slug = 'msn'
ON CONFLICT (subject_id, slug) DO NOTHING;

-- Seed: Sample Topics for Pharmacology
INSERT INTO topics (subject_id, name, slug, sort_order)
SELECT s.id, t.name, t.slug, t.sort_order
FROM subjects s,
     (VALUES ('Emergency Drugs', 'emergency-drugs', 1),
             ('Dosage Calculations', 'dosage-calculations', 2),
             ('Antibiotics', 'antibiotics', 3),
             ('Cardiovascular Drugs', 'cardiovascular-drugs', 4),
             ('CNS Drugs', 'cns-drugs', 5),
             ('Analgesics & Anti-inflammatory', 'analgesics', 6)
     ) AS t(name, slug, sort_order)
WHERE s.slug = 'pharmacology'
ON CONFLICT (subject_id, slug) DO NOTHING;

-- Seed: Sample Topics for FON
INSERT INTO topics (subject_id, name, slug, sort_order)
SELECT s.id, t.name, t.slug, t.sort_order
FROM subjects s,
     (VALUES ('Vital Signs', 'vital-signs', 1),
             ('Nursing Procedures', 'nursing-procedures', 2),
             ('Infection Control', 'infection-control', 3),
             ('Patient Assessment', 'patient-assessment', 4),
             ('Wound Care', 'wound-care', 5),
             ('Documentation', 'documentation', 6)
     ) AS t(name, slug, sort_order)
WHERE s.slug = 'fon'
ON CONFLICT (subject_id, slug) DO NOTHING;

-- Seed: Link subjects to NORCET program
INSERT INTO program_subjects (program_id, subject_id)
SELECT p.id, s.id FROM programs p, subjects s
WHERE p.code = 'NORCET'
ON CONFLICT DO NOTHING;

-- Seed: Products / Packs (from handwritten notes)
INSERT INTO products (name, type, slug, description, price_paise, mrp_paise, features, sort_order) VALUES
  ('Starter Pack — 200 MCQs',   'PACK', 'starter-200',
   'Get started with 200 high-yield MCQs across key nursing subjects.',
   4900, 9900, ARRAY['200 MCQs', 'Detailed explanations', 'Topic-wise breakdown'], 1),
  ('NORCET Mock Test Series',   'BUNDLE', 'norcet-mocks',
   'Complete NORCET preparation with 10-15 full-length mock tests.',
   19900, 29900, ARRAY['10-15 Full Mock Tests', 'Exam-level difficulty', 'Detailed analysis', 'Negative marking practice'], 2),
  ('Complete Exam Pack',         'PACK', 'complete-pack',
   'Everything you need: full mock series + subject tests + PYQs.',
   24900, 39900, ARRAY['All Mock Tests', 'Subject-wise tests', 'PYQ Papers', 'Notes PDFs', 'Priority support'], 3)
ON CONFLICT (slug) DO NOTHING;
