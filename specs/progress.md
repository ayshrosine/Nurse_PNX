# Nursing Level Up — Detailed Progress & Architecture Specification

This document provides a comprehensive overview of the current project state, mapping out the frontend routes, backend architecture, database schemas, and accessibility considerations.

---

## 1. Database Schema (`db/schema.sql`)

The database uses PostgreSQL, tracking the core lifecycle of test creation, document extraction, student purchases, and attempts.

### Key Types & Enums
- `user_role`: `STUDENT`, `ADMIN`
- `test_status`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `document_status`: Lifecycle of AI processing (`UPLOADED`, `EXTRACTING`, `EXTRACTED`, `GENERATING`, etc.)
- `attempt_status`: `IN_PROGRESS`, `COMPLETED`, `ABANDONED`
- `payment_provider`: `RAZORPAY`, `STRIPE`

### Core Tables
1. **`users`**
   - Fields: `id`, `google_id`, `name`, `email`, `phone`, `role`, `status`, `last_login_at`
   - Purpose: Stores student and admin profiles. Handles NextAuth integrations.

2. **`test_series`**
   - Fields: `id`, `title`, `description`, `price`, `currency`, `is_free`, `duration_minutes`, `status`, `instructions`
   - Purpose: Contains the root object for a mock test. 

3. **`documents`**
   - Fields: `id`, `test_series_id`, `uploaded_by`, `original_filename`, `file_type`, `storage_key`, `status`, `ocr_provider`, `ai_provider`
   - Purpose: Tracks the lifecycle of PDFs/DOCX uploaded for AI question generation.

4. **`questions`**
   - Fields: `id`, `test_series_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `explanation`, `question_order`, `source` (MANUAL, IMPORTED, AI_GENERATED), `source_document_id`
   - Purpose: Stores Multiple Choice Questions linked to a test series.

5. **`purchases` & `payment_events`**
   - Fields (purchases): `id`, `user_id`, `test_series_id`, `amount`, `order_id`, `payment_id`, `status`
   - Purpose: Tracks Razorpay purchases and creates a webhook audit log.

6. **`attempts` & `user_answers`**
   - Fields (attempts): `id`, `user_id`, `test_series_id`, `score`, `total_questions`, `time_taken_seconds`, `question_ids`
   - Fields (user_answers): `attempt_id`, `question_id`, `selected_answer`, `is_correct`
   - Purpose: Captures a student's live test session and specific answer choices.

7. **`audit_logs` & `platform_settings`**
   - Purpose: Maintains global platform config (like default OCR tool) and an audit trail of admin actions.

---

## 2. Backend Architecture (`src/lib/server`)

The backend is modularized into dedicated domain services and APIs to ensure separation of concerns.

### Core Services
- **`ai.ts` & `extract.ts`**: Contains the pipeline for chunking and parsing PDFs (`pdf-parse`), DOCX (`mammoth`), or OCR (`tesseract.js`), and sending them to an AI Provider (Gemini/OpenAI) to map out structured JSON MCQs.
- **`auth.ts` & `session.ts`**: Implements NextAuth validations and Role-Based Access Control (RBAC).
- **`razorpay.ts` & `purchaseService.ts`**: Handles order generation, signature verification, and granting test access.
- **`scoring.ts` & `attemptService.ts`**: Contains the business logic to calculate percentages and scores for a submitted test.
- **`storage.ts`**: Wraps the AWS S3 client for generating pre-signed upload URLs and fetching documents.

### API Routes (`src/app/api/...`)
- **`/api/auth/[...nextauth]`**: Standard NextAuth endpoints.
- **`/api/admin/*`**: Secured endpoints specifically for Admin CRUD operations on users, test-series, and purchases.
- **`/api/documents/upload` & `/extract` & `/generate`**: Handles the multi-step AI document pipeline.
- **`/api/payments/razorpay/webhook`**: Listens for Razorpay successful payments and grants user access idempotently.
- **`/api/tests/[id]/start` & `/submit`**: Starts a test session, tracking elapsed time, and calculates the final score upon submission.

---

## 3. Frontend & App Router (`src/app`)

Built with React 19 and Tailwind v4, utilizing Next.js Server Components for heavy lifting and Client Components for interactivity.

### Student Facing Routes
- **`/login` & `/auth/continue`**: Onboarding and OAuth logins.
- **`/dashboard`**: Central hub displaying unlocked test series and recent scores.
- **`/profile`**: User account settings and past attempts history.
- **`/test-series/[id]`**: Detail page showing test instructions and paywall (Checkout UI).
- **`/unlock/[id]`**: Payment redirection/success page.
- **`/results/[id]`**: Detailed breakdown of a finished attempt (correct vs incorrect analysis).

### Admin Panel Routes (`/admin`)
- **`/admin/(panel)`**: Dashboard overview with high-level metrics.
- **`/admin/test-series/create` & `/edit` & `/import`**: Full suite to build tests manually or upload documents for AI generation.
- **`/admin/questions`**: View and moderate AI-generated questions before publishing.
- **`/admin/users` & `/admin/purchases`**: CRMs to track student signups and revenue.

---

## 4. Accessibility & Security

### Security & Authorization
- **RBAC Enforcement**: Admin API routes validate session roles (`user.role === 'ADMIN'`) before execution.
- **Idempotency**: Webhook endpoints (Razorpay) log `payment_events.event_id` to prevent double-charging or race conditions.
- **Data Integrity**: Tests track `question_ids` as an array at the exact moment of the attempt. Subsequent edits to a test series by an admin do not retroactively alter a student's past attempt score.
- **Presigned URLs**: S3 files are never exposed publicly. Clients request short-lived presigned URLs to upload or read documents.

### Accessibility (a11y)
- **Semantic HTML**: React components utilize proper landmarks (`<nav>`, `<main>`, `<aside>`).
- **Form Validation**: `zod` is heavily used on the frontend and backend to validate all payloads, displaying clear, readable error messages.
- **Responsive UI**: Tailwind classes are utilized to ensure the Dashboard, Admin Panel, and the Test Runner (which requires dense data display) gracefully degrade on mobile viewports.
