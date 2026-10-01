# Nursing Level Up: System Design & SDLC Guide

Scope: evolve the current test-series app into a nursing prep platform with Program > Semester > Subject > Topic question banks, year-wise PYQs, exam packs, daily quiz, notes PDFs and payments.

## 1. Requirements (SDLC phase 1)

**Where to get them**

- Your handwritten plan (already the best source: pricing, exam list, funnel).
- Real students: 10-15 short calls or WhatsApp polls with BSc/GNM students and NORCET aspirants. Ask: what do you pay for today, what annoys you, which subject is hardest.
- Competitor teardown: install 3-4 nursing/NORCET test apps, list features and prices.
- Official syllabi: INC syllabus for BSc/GNM, the NORCET notification/syllabus from AIIMS.
- Analytics after launch: where users drop off, which tests get attempted.

**Where to store them**

- In the repo: `/docs/requirements/PRD.md` (vision, users, scope), `/docs/requirements/user-stories.md`, `/docs/adr/` (one file per design decision).
- GitHub Issues/Projects for the backlog; label `must/should/could`.
- Rule: every feature = user story + acceptance criteria before coding.

**How to use them**: PRD -> user stories -> DB/API design -> tasks -> tests that mirror acceptance criteria.

**Core user stories (MoSCoW)**

- MUST: browse by program/semester/subject/topic; take timed test; see result with explanations; buy a pack via Razorpay; free tests without payment; PYQ by exam and year; admin imports/reviews questions.
- SHOULD: daily 10-Q free quiz + streak; bookmarks; weak-topic analytics; downloadable notes PDFs (paid/free); coupons.
- COULD: leaderboard, Hindi questions, referral, push/WhatsApp reminders.

**Non-functional**: mobile-first (most users are on phones), test page works on weak networks (autosave), \~5-10k concurrent test takers on exam days, 99.5% uptime, DPDP Act-aware data handling, GST invoices.

## 2. Architecture decision

Keep your **modular monolith** (Next.js + services layer + Postgres). Do NOT split into microservices now: one developer, small traffic, high ops cost. Extract only what is genuinely different in load shape:

| Component | Now | When to split out |
| --- | --- | --- |
| Web + API (Next.js) | one deploy | later: separate API only if needed |
| Document/AI pipeline | inside API | **First to extract**: background worker + queue (pg-boss on Postgres, or BullMQ+Redis). Tesseract/AI calls are slow and must not block requests |
| Cache/rate-limit/timers | none | Redis (Upstash) for catalog cache, rate limits, daily-quiz cache |
| Notes PDFs, uploads | S3 | keep S3 + CloudFront/presigned URLs |
| Email/WhatsApp notifications | none | worker job |

Add: Postgres connection pooling (PgBouncer / managed pooler), Sentry for errors, structured logs.

## 3. Content model (database changes)

Your `questions.test_series_id` ties a question to ONE test. A question bank needs questions to exist independently and be reused by many tests. **Biggest change: introduce a many-to-many link.**

```sql
-- Taxonomy
CREATE TABLE programs   (id uuid PK, code text UNIQUE, name text);        -- BSC_NURSING, GNM, NORCET, ESIC, RRB, CHO, STATE_CET
CREATE TABLE semesters  (id uuid PK, program_id uuid REFERENCES programs, number int, label text); -- Year/Sem
CREATE TABLE subjects   (id uuid PK, name text, slug text UNIQUE);          -- FON, MSN, Pharmacology...
CREATE TABLE program_subjects (program_id uuid, semester_id uuid NULL, subject_id uuid, PRIMARY KEY(program_id, semester_id, subject_id));
CREATE TABLE topics     (id uuid PK, subject_id uuid, parent_id uuid NULL, name text, slug text, UNIQUE(subject_id, slug)); -- e.g. MSN > Cardiovascular > Heart failure

-- PYQ sources
CREATE TABLE exam_papers (id uuid PK, program_id uuid, exam_name text, exam_year int, shift text NULL,
  source_type text, source_note text, license_status text, UNIQUE(exam_name, exam_year, shift));

-- Question bank (extend existing `questions`)
ALTER TABLE questions
  ADD COLUMN subject_id uuid, ADD COLUMN topic_id uuid,
  ADD COLUMN difficulty smallint,          -- 1 easy..3 hard
  ADD COLUMN exam_paper_id uuid NULL,      -- set => this is a PYQ
  ADD COLUMN paper_qno int NULL,
  ADD COLUMN review_status text DEFAULT 'DRAFT',  -- DRAFT|IN_REVIEW|APPROVED|REJECTED
  ADD COLUMN reviewed_by uuid, ADD COLUMN content_hash text,  -- dedupe
  ADD COLUMN language text DEFAULT 'en', ADD COLUMN version int DEFAULT 1;
CREATE UNIQUE INDEX ON questions(content_hash) WHERE review_status <> 'REJECTED';
CREATE INDEX ON questions(subject_id, topic_id, review_status);

-- Many-to-many: tests are curated lists of bank questions
CREATE TABLE test_series_questions (test_series_id uuid, question_id uuid, position int, PRIMARY KEY(test_series_id, question_id));
-- migrate: INSERT from questions.test_series_id, then make questions.test_series_id nullable/deprecated.

-- Tests get a type and taxonomy
ALTER TABLE test_series ADD COLUMN test_type text,   -- FULL_MOCK|SUBJECT|TOPIC|PYQ|DAILY|SEMESTER
  ADD COLUMN program_id uuid, ADD COLUMN subject_id uuid, ADD COLUMN topic_id uuid,
  ADD COLUMN question_count int, ADD COLUMN negative_marking numeric DEFAULT 0, ADD COLUMN slug text UNIQUE;
```

Commerce and engagement:

```sql
CREATE TABLE products (id uuid PK, name text, type text, price_paise int, mrp_paise int, active bool); -- SINGLE_TEST|BUNDLE|NOTES|PACK
CREATE TABLE product_items (product_id uuid, test_series_id uuid NULL, resource_id uuid NULL);
CREATE TABLE entitlements (id uuid PK, user_id uuid, product_id uuid, source_purchase_id uuid, granted_at timestamptz, expires_at timestamptz NULL, UNIQUE(user_id, product_id));
CREATE TABLE coupons (code text PK, percent_off int, max_uses int, used int, valid_till timestamptz);
CREATE TABLE resources (id uuid PK, title text, subject_id uuid, storage_key text, is_free bool);  -- notes/PDFs
CREATE TABLE bookmarks (user_id uuid, question_id uuid, PRIMARY KEY(user_id, question_id));
CREATE TABLE daily_quizzes (quiz_date date PRIMARY KEY, test_series_id uuid);
CREATE TABLE user_topic_stats (user_id uuid, topic_id uuid, attempted int, correct int, PRIMARY KEY(user_id, topic_id));
CREATE TABLE leads (id uuid PK, email text, phone text, source text, created_at timestamptz); -- free-test / link-in-bio funnel
```

Change `purchases` to reference `products` (not only `test_series`); access checks read `entitlements`. Store money in **paise integers**. Add `UNIQUE(order_id)` and keep `payment_events.event_id UNIQUE`.

## 4. Backend changes

Services to add under `src/lib/server/services`: `catalogService` (programs/subjects/topics, cached), `questionBankService` (filters, review workflow, dedupe), `paperService` (PYQ), `productService` + `entitlementService`, `practiceService` (topic practice, instant feedback), `dailyQuizService`, `analyticsService` (topic stats), `resourceService` (signed notes URLs), `couponService`, `leadService`.

Key endpoints:

- Public: `GET /api/catalog` (tree), `GET /api/tests?program=&subject=&type=`, `GET /api/papers?exam=&year=`
- Student: `POST /api/tests/:id/start`, `PUT /api/attempts/:id/answers` (autosave), `POST /api/attempts/:id/submit`, `GET /api/me/analytics`, `POST /api/bookmarks`, `GET /api/resources/:id/download`
- Pay: `POST /api/payments/razorpay/order`, `.../verify`, `.../webhook`
- Admin: bulk import (CSV/JSON/docs), review queue, bulk approve, paper management, product/coupon CRUD.

Rules: authorization via `entitlements` in ONE function (`canAccess(user, test)`); all payloads validated with zod; scoring always server-side; never send `correct_answer`/`explanation` to the client until submit (for timed tests) .

## 5. Frontend changes

Routes: `/` (landing + free tests CTA), `/exams/norcet`, `/exams/[program]`, `/browse/[program]/[semester]/[subject]` -> topics list with counts, `/practice/[topic]` (untimed, instant feedback), `/pyq/[exam]/[year]`, `/daily-quiz`, `/packs` (pricing: Rs 99/149/249 plans), `/notes`, `/dashboard` (progress, weak topics, streak), `/bookmarks`. Admin: `/admin/taxonomy`, `/admin/bank` (filter, bulk edit), `/admin/review`, `/admin/papers`, `/admin/products`, `/admin/coupons`, `/admin/leads`. UX musts: mobile-first test runner with question palette, mark-for-review, resume after refresh, Hindi/English toggle later, free tests accessible after only Google login (low-friction funnel from your link-in-bio posts), SEO pages (static/ISR) for each topic and PYQ.

## 6. Users, concurrency and timing

- **Server-authoritative timer**: store `started_at` + `ends_at` on the attempt; client timer is cosmetic; reject submits after `ends_at + grace`; auto-submit expired attempts via scheduled job.
- **Autosave** answers every answer-change (debounced) with upsert on `(attempt_id, question_id)`.
- **Idempotent start**: one IN_PROGRESS attempt per (user, test); partial unique index, return existing instead of creating another.
- **Submit once**: `UPDATE ... WHERE status='IN_PROGRESS'` and check rows affected.
- Exam-day spikes: test questions (without answers) cached in Redis/CDN per test; pooled DB connections; paginate admin lists; indexes on `attempts(user_id)`, `user_answers(attempt_id)`.
- Rate limit login, payments, start endpoints. Load test with k6 before NORCET season.

## 7. Payments (Razorpay)

Flow: create order server-side (price from `products`, never from client) -> checkout -> client sends payment id+signature -> server verifies HMAC -> grants entitlement. **Webhook is the source of truth** (`payment.captured`/`order.paid`), because users close tabs. Both paths call one idempotent `fulfillOrder(orderId)` inside a DB transaction. Also: verify webhook signature on raw body, log every event, handle `payment.failed` and refunds (revoke entitlement), reconcile daily against Razorpay's API, GST invoice generation if you cross registration threshold (confirm with a CA), clear refund/terms/privacy pages (Razorpay KYC requires them).

Pricing from your notes: Rs 49-99 entry (200 MCQs), single paid tests Rs 99/149, NORCET pack about Rs 249 with 10-15 mocks. Model each as a `product`. Anchor with `mrp_paise` and launch coupons.

## 8. Security and compliance

RBAC on every admin route; signed URLs for notes (watermark PDFs with user email to deter sharing); no answer leakage; account-level device/session limits optional; backups with tested restore; secrets in env; India DPDP: consent, privacy policy, delete-account flow.

## 9. Delivery roadmap

1. **Week 1-2**: taxonomy + `test_series_questions` migration + question bank admin + review workflow.
2. **Week 3-4**: browse/practice by subject/topic, free tests, daily quiz, autosave and server timer.
3. **Week 5-6**: products/entitlements/packs, coupons, PYQ section, notes PDFs.
4. **Week 7+**: analytics, SEO pages, Redis/worker split, load test, beta with 30-50 students, then launch.

Quality: unit tests for scoring/entitlements/webhook idempotency; Playwright for login > buy > attempt > result; CI on every PR; staging DB; migrations via a tool (node-pg-migrate/Drizzle), never hand-edit prod. Metrics: signup > free test > paid conversion, attempts/user, completion rate, refund rate, content error reports (add a "report this question" button).

## 10. Decisions to confirm (assumptions I made)

- Handwritten timing lines (4 Q = 8 min, 6 Q = 15 min) and "Subject-wise MSN, Pharma" were crossed out, so I treated them as dropped; timings used: 50 Q/60 min, 100 Q/120 min.
- Stripe stays unused; Razorpay only.