# Nursing Level Up: Exam-Centric Product Flow, Admin Console & PYQ Handling

Reference model: the MARKS app (JEE/NEET). From its public description, the ideas worth borrowing are: a catalogue of exams, **chapter-wise PYQs by exam and year range**, custom tests, quiz mode, bookmarks/notebooks, a **daily practice challenge with goals**, progress tracking at overall/subject/chapter level, topic weightage, and revision notes. We copy the structure and ideas, never their content. Nursing Level Up = the same shape for NORCET, ESIC, RRB, state CHO, BSc/GNM semester exams and state CETs.

## 1. Core change in one picture

```
Exam (NORCET, ESIC, BSc Sem 3 ...)          <- everything lives inside an Exam
 |- Subjects (FON, MSN, Pharmacology ...)    <- admin adds/removes per exam
 |   |- Topics (Cardiovascular > Heart failure)
 |   |- Subject test (cumulative) / Topic tests / Practice
 |   |- PYQs of this subject (by year and by topic)
 |- Full mock tests (Test Series)
 |- PYQ papers (full paper by year/shift)
 |- Daily Quiz (for THIS exam, optionally per subject)
 |- Notes/PDFs
 Each item: FREE or PAID
```

Navbar change: **remove "Daily Quiz" from the global navbar.** A quiz for "everyone" does not fit students preparing for different exams. Daily Quiz becomes a tab inside every exam hub, and the dashboard shows "Today's quiz" for the student's selected exam.

## 2. Student flow (screen by screen)

**Navbar (logged out):** Logo | Exams | Packs | Free Tests | Login. **Logged in:** Logo | **My Exam \[switcher\]** | Exams | Packs | Dashboard | Profile.

1. **Landing `/`**: hero ("Pick your nursing exam"), exam cards, free-test CTA (for your link-in-bio traffic), pricing teaser, trust points.
2. **Login (Google)**: free items are reachable after login only, no payment needed. First login shows **"Which exam are you preparing for?"** (multi-select, one primary). Saved to `user_exams`; sets "My Exam".
3. **Exam hub `/exams/[exam]`** with tabs:
   - **Overview**: syllabus summary, pattern, counts (X PYQs, Y tests), student's progress, pass/pack CTA.
   - **Subjects**: grid of subjects with question count and progress bar.
   - **PYQs**: Free | Paid filter chips; view toggle **By Year** (papers) / **By Subject** (topic-wise).
   - **Test Series**: Free | Paid | Full mocks | Subject tests.
   - **Daily Quiz**: today's 10 questions for this exam, streak, calendar of past quizzes.
   - **Notes**: PDFs, free/paid.
4. **Subject page `/exams/[exam]/[subject]`**: header with progress; sections: **Topics list** (each with question count, accuracy, a lock icon if paid), **Take Subject Test** (cumulative: pick count 20/30/50, difficulty, include PYQs toggle), **Subject PYQs**, **Subject tests**.
5. **Topic page**: choose **Practice mode** (untimed, instant answer + explanation, bookmark) or **Topic Test** (timed, N questions, scored); **PYQs of this topic** across years.
6. **Test runner**: palette, mark for review, autosave, server timer (see earlier design doc). Practice runner shows answer after each question.
7. **Result `/results/[id]`**: score, accuracy, time, topic-wise breakdown, solutions, "Retry wrong questions", "Practice weak topics".
8. **Dashboard**: continue where you left, today's quiz (for My Exam), weak topics, streak, recent attempts, bookmarks/notebook.

**Free vs paid in the UI**

| Item | Free user | Paid (entitled) user |
| --- | --- | --- |
| Free PYQ paper / free test / daily quiz | open directly | open |
| Paid PYQ paper / test series | card shows price, lock, "Preview 5 questions" | open |
| Exam Pass (all paid items of an exam) | Buy button on exam hub | everything unlocked |
| Rules: always show the lock and price (no hidden content); one purchase unlocks across web sessions; locked items return 403 from the API even if the URL is guessed. |  |  |

## 3. Admin console (what the admin can do)

New admin menu: **Exams | Subjects & Topics | Question Bank | PYQ Papers | Test Series | Daily Quizzes | Products & Coupons | Notes | Review Queue | Users & Purchases | Audit Log**. Every list has search, status filter (Draft/Published/Archived), create, edit, reorder (drag), and delete/archive.

### 3.1 Create an exam

`Admin > Exams > New Exam`: name, slug, short description, syllabus text, exam pattern (questions, marks, negative marking, duration), logo/banner, status (Draft/Published), display order. Save as Draft, add subjects, then Publish. Edit anytime. Delete rules in 3.7.

### 3.2 Add subjects to an exam

`Exam > Subjects tab > Add subject`: choose an existing subject (FON, MSN...) **or create a new one**, set display order and optional exam-specific weightage. A subject can belong to many exams (it is one record linked via `exam_subjects`), so Pharmacology is written once and reused in NORCET and ESIC. "Remove from exam" only unlinks; "Delete subject globally" is a separate guarded action.

### 3.3 Add topics to a subject

`Subject > Topics`: tree editor (add child, rename, move, reorder). Bulk add by pasting one topic per line. Topic slugs are frozen after publish.

### 3.4 Add PYQs (inside the exam and subject)

`Exam > PYQs > New Paper` or `Subject > PYQs > Add`. Two-step:

1. **Paper record**: exam, year, shift/session, source note and URL, license status, duration, total marks, negative marking, **Free or Paid**, status.
2. **Add questions** by any of: (a) manual form, (b) CSV/Excel upload, (c) PDF/DOCX upload through the AI extraction pipeline, (d) copy from the existing bank. Each question must get **subject + topic** (bulk-tag grid helps) and the official answer key. See section 5 for the full pipeline. Result: one paper is viewable **By Year** and its questions automatically appear under **By Subject/Topic**.

### 3.5 Add test series (free or paid)

`Exam > Test Series > New`: type (Full Mock | Subject Test | Topic Test | Custom), subject/topic (for subject/topic types), duration, marks, negative marking, instructions, **access = FREE or PAID**, price/product (for paid), schedule (publish time). Choose questions via: manual pick from bank with filters, **auto-compose by blueprint** (e.g. 40% MSN, 30% FON...), or import. Preview as a student, then Publish. To sell: `Products > New Product` (single test / bundle / **Exam Pass**), select included items, price (paise), MRP, validity (e.g. 12 months), coupons.

### 3.6 Daily quizzes for an exam or a subject

`Exam > Daily Quiz`: (a) **Schedule** one quiz per date (pick 10 questions or auto-fill from filters: subject, topic, difficulty), (b) **Auto mode**: tick "auto-generate daily quiz" and the system picks 10 approved, previously unseen questions per day for that exam (optionally rotating subjects), (c) optional **per-subject quiz** (`Subject > Daily Quiz`). A calendar shows scheduled/auto/missing days; if nothing is scheduled the auto mode is the fallback so a student never sees an empty page. Daily quizzes are FREE by default (your lead magnet); can be set PAID.

### 3.7 Edit and delete safely

| Action | Behavior |
| --- | --- |
| Edit anything | allowed; questions get `version+1`; past attempts keep their snapshot |
| Archive exam/subject/test | hidden from students, data kept, restorable |
| Hard delete exam/subject/test/paper | only if it has **no attempts, no purchases, no published children**; otherwise the UI says why and offers Archive |
| Delete subject | removes link or record; its questions are **not deleted**, they become "Unassigned" in the bank |
| Delete question | soft delete (status REJECTED/removed); excluded from new tests; old results still show it |
| Confirm | type the name to confirm; every change goes to the audit log (who, what, before/after) |

## 4. Data model (builds on the earlier design doc; "programs" = exams)

```
exams(id, slug, name, description, pattern jsonb, status, sort_order)
subjects(id, slug, name)                  -- global
exam_subjects(exam_id, subject_id, sort_order, weightage, PK(exam_id, subject_id))
topics(id, subject_id, parent_id, slug, name, sort_order)
question_exams(question_id, exam_id)       -- which exams a question serves
exam_papers(id, exam_id, year, shift, access_tier, status, source_*, license_status, pattern jsonb)
paper_questions(paper_id, question_id, qno)   -- many-to-many so repeats are one record
questions(..., subject_id, topic_id, review_status, content_hash, version)
test_series(id, exam_id, subject_id?, topic_id?, test_type, access_tier FREE|PAID, status, publish_at, ...)
test_series_questions(test_series_id, question_id, position)
daily_quizzes(id, exam_id, subject_id?, quiz_date, source SCHEDULED|AUTO, test_series_id, access_tier, UNIQUE(exam_id, subject_id, quiz_date))
user_exams(user_id, exam_id, is_primary)
products / product_items / entitlements   -- items = tests, papers, notes; or whole exam (exam pass)
streaks(user_id, exam_id, current, best, last_quiz_date)
```

Access rule in one function: `canAccess(user, item)` = item.tier is FREE, **or** entitlement exists for the item, **or** for an exam pass covering item.exam_id, **or** user is admin.

## 5. PYQ handling in detail

### 5.1 Why PYQs are hard

Papers come as PDFs/scans with images, tables and bilingual text; answer keys are separate and sometimes revised; the same question repeats across years; questions must appear both **by paper** and **by topic**; and rights/licensing differ per paper.

### 5.2 Collection and licensing

Use official/public papers and keys from the conducting bodies and universities where their terms allow, your own authored "memory-based" questions labelled as such, or licensed sets. Log source URL, retrieval date and license status per paper. Do not republish a competitor's solutions or explanations; write your own explanations. Ask a lawyer to confirm the approach.

### 5.3 Ingestion pipeline (per paper)

1. **Create paper** (metadata above), upload source file to S3 (private).
2. **Extract**: CSV direct; PDF/DOCX through pdf-parse/mammoth/OCR + AI into structured MCQs (existing pipeline, runs in background worker, status UPLOADED > EXTRACTING > EXTRACTED).
3. **Staging table** `import_rows` shows extracted questions beside the source page image so the admin can fix OCR errors fast.
4. **Normalize and dedupe**: compute `content_hash`; exact match = link to the existing question (`paper_questions` row, no duplicate); near-match (trigram > 0.9) = side-by-side "same question?" prompt.
5. **Attach answer key**: upload key CSV (qno > answer) or type it; mismatch check flags questions with missing/invalid answers. Store `key_version`.
6. **Tag**: bulk-assign subject and topic (AI suggests, human confirms); required before publish.
7. **Explanations**: own text mandatory for paid papers, recommended for free; AI draft allowed but needs reviewer approval.
8. **Review** (second person for pharmacology/dose items), then **Publish** paper. Publishing validates: every question has answer, subject, topic, approved status; count equals declared total.

### 5.4 Student-facing PYQ behavior

- **By Year**: grid of papers (NORCET 2024 Shift 1 ...) with Free/Paid badge; opens as a timed mock mimicking the real pattern, or "practice mode".
- **By Subject/Topic** (the MARKS-style view): select subject > topic > year range filter > practice questions with each question tagged "NORCET 2023".
- Counts such as "Cardiovascular: 38 PYQs (2019-2024)", a topic **weightage chart** (how many questions per topic per year) built from tagged data.
- A repeated question shows "Asked 3 times: 2019, 2021, 2024".
- Free vs paid at paper level (e.g. latest 2 years paid, older years free) or at question level for samples; set via `access_tier`.
- If an official key changes: update key, bump version, show "answer updated" note; past attempts keep their stored result unless admin triggers a re-score.

### 5.5 Edge cases to handle

Images in questions/options (store in S3, reference by key), bilingual text (language field, later), questions dropped by the board (mark `is_dropped`, exclude from scoring), multi-correct or "all of the above" (avoid or support), partially extracted papers (stay Draft), same paper uploaded twice (unique exam+year+shift).

## 6. Data flow summaries

- **Student opens a paid test**: browser > `GET /api/exams/:slug/tests` (list with lock flags) > click > `POST /api/tests/:id/start` > server runs `canAccess` > creates attempt (`ends_at`) > returns questions **without answers** > autosave `PUT /api/attempts/:id/answers` > `POST .../submit` > server scores, writes `user_answers`, updates `user_topic_stats` and streak > result page.
- **Purchase**: `POST /api/payments/order` (server reads price from product) > Razorpay checkout > webhook `order.paid` > idempotent fulfil > entitlements > UI unlock.
- **Admin publishes paper**: form/upload > S3 > worker extraction > staging > review > publish > cache for exam hub invalidated.
- **Daily quiz**: cron at midnight IST ensures a quiz exists per active exam (scheduled or auto); student fetch is cached per exam per date. Key endpoints (new): `GET /api/exams`, `GET /api/exams/:slug`, `.../subjects`, `.../subjects/:s/topics`, `.../papers`, `.../daily-quiz`, `POST /api/exams/:id/my-exam`; admin: CRUD on `/api/admin/exams`, `/subjects`, `/topics`, `/papers`, `/tests`, `/daily-quizzes`, `/products`, plus `/api/admin/papers/:id/import` and `/publish`. All admin routes require ADMIN role and write an audit log row.

## 7. Security and "end-to-end encryption": what is realistic

True end-to-end encryption (only the user's device can read data) is **not possible or appropriate** here: your servers must read questions, answers and attempts to serve tests, score, and generate analytics. What you should do instead:

- **In transit**: HTTPS/TLS everywhere with HSTS (Vercel/Neon/S3/Razorpay already enforce it).
- **At rest**: Neon storage encryption, S3 server-side encryption (SSE-S3 or KMS), encrypted backups.
- **Payments**: never handle card data; Razorpay checkout does it; you store only order/payment ids.
- **Secrets**: only in environment variables; rotate on staff change.
- **Content protection**: answers/explanations never sent before submit; paid PDFs and source papers only via short-lived signed URLs; watermark PDFs with user id; rate-limit question fetches. Screenshots cannot be fully prevented, so also watermark the test runner lightly.
- **Privacy**: collect minimum PII (name, email, optional phone); consent text; delete-account flow; log access to admin data (India DPDP Act expectations; confirm specifics with a lawyer).
- **Admin**: Google login restricted to allow-listed emails, optional 2FA, audit log, no shared accounts. If you later need sensitive fields encrypted (phone numbers), use field-level encryption with a key kept outside the database.

## 8. Build order

1. Exams, exam_subjects, user_exams, exam hub shell; navbar change; move Daily Quiz into exams.
2. Admin: Exams > Subjects > Topics CRUD with archive/delete rules and audit log.
3. Question bank link tables and `question_exams`; subject/topic tests (cumulative + topic) with the pool query.
4. PYQ papers: paper CRUD, CSV import, staging, key upload, tagging, publish; By Year and By Topic views.
5. Free/paid tiers on papers/tests, products, exam pass, entitlements checks and lock UI.
6. Daily quiz scheduling, auto mode, streaks per exam.
7. Analytics (topic accuracy, weightage chart), bookmarks/notebook, notes. **Acceptance checks**: a student sees only published items of their exam; locked items are not startable by URL; deleting a subject with attempts is blocked; a paper cannot be published with untagged questions; each exam has a daily quiz every day; a question repeated in 3 papers exists once.