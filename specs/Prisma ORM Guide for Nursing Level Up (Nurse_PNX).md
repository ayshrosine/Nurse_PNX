# Prisma ORM Guide for Nursing Level Up (Nurse_PNX)

## 0. What I found in your repo (read this first)

- The repo **already has a `prisma/` folder**, and the README lists "Prisma ORM & raw `pg` queries" on Neon PostgreSQL, deployed on Vercel. So you are in a **hybrid state**, not starting from zero.
- The README setup uses `prisma generate` + `prisma db push`. That is fine for early prototyping but unsafe for production (no migration history, can drop data on destructive changes).
- GitHub blocked me from reading `schema.prisma`, `package.json` and the services, so I could not see which tables are modelled or which version you have. **Section 2 gives commands that tell you.** Treat all code below as templates and adjust names to your real schema.

Goal: make Prisma the single typed data layer, with versioned migrations, safe transactions for payments/attempts, and no more scattered raw SQL (except where Prisma cannot express a query).

## 1. Version decision: use Prisma 7

Prisma 7 changes setup, so check yours first (`npx prisma -v`):

- Generator is `prisma-client` with an explicit `output` path, and you import from the generated path (not `@prisma/client`). The old `prisma-client-js` is deprecated.
- A **driver adapter is required**. For Neon use `@prisma/adapter-neon`; for plain Postgres use `@prisma/adapter-pg`.
- Database URLs for the CLI live in **`prisma.config.ts`**, not in `schema.prisma`. It does not auto-load `.env`; import `dotenv/config` at the top.
- Keep `prisma` and `@prisma/client` on the **same major version**. If you are on 5/6, either upgrade following Prisma's "Migrate to v7" guide, or stay on 6 consciously and skip adapter/config steps. Do the upgrade on its own branch, before any schema work.

## 2. Audit (30 minutes, do this first)

```bash
npx prisma -v
npx prisma validate
cat prisma/schema.prisma | head -100
grep -rn "from 'pg'\|new Pool\|pool.query\|client.query" src | head -50   # raw SQL spots
grep -rn "prisma\." src | wc -l                                            # Prisma usage
ls prisma/migrations 2>/dev/null || echo "no migrations folder"
```

Make a table: service file -> uses Prisma / raw pg / mixed. This is your migration backlog.

## 3. Setup files

```bash
npm i @prisma/client @prisma/adapter-neon dotenv
npm i -D prisma tsx
```

`prisma.config.ts`

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DIRECT_URL") },   // CLI/migrations use the DIRECT (non-pooled) Neon URL
});
```

`schema.prisma` header

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
datasource db { provider = "postgresql" }
```

`src/lib/server/db.ts` (singleton so hot reload/serverless does not exhaust connections)

```ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

const make = () =>
  new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
const g = globalThis as unknown as { prisma?: ReturnType<typeof make> };
export const prisma = g.prisma ?? make();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

Env: `DATABASE_URL` = Neon **pooled** URL (host contains `-pooler`) for the app at runtime; `DIRECT_URL` = Neon direct URL for migrations. Set both in Vercel and `.env.local`. `package.json`: `"postinstall": "prisma generate"`, and add `src/generated/` to `.gitignore` (generated on every install/build).

## 4. Move from `db push` to real migrations (baseline)

Do this once, carefully, with a **Neon branch copy of production** first.

1. Make `schema.prisma` match the live DB: `npx prisma db pull` into a scratch copy, then reconcile (keep your naming).
2. Create the baseline SQL without touching the DB: `mkdir -p prisma/migrations/0_init && npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql`
3. Mark it as already applied on existing databases: `npx prisma migrate resolve --applied 0_init`
4. From now on: dev = `npx prisma migrate dev --name add_taxonomy`; prod/Vercel = `npx prisma migrate deploy` (run in the build command or a release step). **Never run `db push` on production.**
5. Review every generated `migration.sql` before merging (look for DROP/ALTER that lose data). For risky changes use expand-contract: add new column -> backfill -> switch code -> remove old column in a later migration.

Use **Neon branching**: one branch per preview/PR for testing migrations on realistic data.

## 5. Schema for the planned features

Prisma maps names with `@map/@@map`, so you can keep existing snake_case tables. Core of the new question-bank model:

```prisma
enum ReviewStatus { DRAFT IN_REVIEW APPROVED REJECTED }
enum AttemptStatus { IN_PROGRESS COMPLETED ABANDONED }

model Program { id String @id @default(uuid()) @db.Uuid
  code String @unique  name String
  semesters Semester[] tests TestSeries[]  @@map("programs") }

model Subject { id String @id @default(uuid()) @db.Uuid
  name String  slug String @unique
  topics Topic[] questions Question[]  @@map("subjects") }

model Topic { id String @id @default(uuid()) @db.Uuid
  subjectId String @map("subject_id") @db.Uuid  parentId String? @map("parent_id") @db.Uuid
  name String  slug String
  subject Subject @relation(fields: [subjectId], references: [id])
  questions Question[]
  @@unique([subjectId, slug])  @@map("topics") }

model Question { id String @id @default(uuid()) @db.Uuid
  text String @map("question_text")  optionA String @map("option_a") /* b,c,d same */
  correctAnswer String @map("correct_answer")  explanation String?
  topicId String? @map("topic_id") @db.Uuid  subjectId String? @map("subject_id") @db.Uuid
  examPaperId String? @map("exam_paper_id") @db.Uuid  paperQno Int? @map("paper_qno")
  reviewStatus ReviewStatus @default(DRAFT) @map("review_status")
  contentHash String? @map("content_hash")  version Int @default(1)
  tests TestSeriesQuestion[]
  @@index([subjectId, topicId, reviewStatus])  @@map("questions") }

model TestSeriesQuestion { testSeriesId String @map("test_series_id") @db.Uuid
  questionId String @map("question_id") @db.Uuid  position Int
  test TestSeries @relation(fields: [testSeriesId], references: [id])
  question Question @relation(fields: [questionId], references: [id])
  @@id([testSeriesId, questionId])  @@map("test_series_questions") }
```

(Also model `TestSeries`, `Product`, `Entitlement`, `Purchase`, `PaymentEvent`, `Attempt`, `UserAnswer`, `Coupon`, `Resource`, `Bookmark`, `DailyQuiz`, `UserTopicStat`, `Lead` the same way; see the system design guide for columns.)

**What Prisma schema cannot express** (put in a hand-edited migration SQL): partial unique indexes, e.g.

```sql
CREATE UNIQUE INDEX uq_question_hash ON questions(content_hash) WHERE review_status <> 'REJECTED';
CREATE UNIQUE INDEX uq_one_active_attempt ON attempts(user_id, test_series_id) WHERE status = 'IN_PROGRESS';
```

Create with `migrate dev --create-only`, edit the SQL, then apply. Do not let `db push` ever "fix" these away. Store money as `Int` paise.

## 6. Converting services from raw `pg` (incremental, one service per PR)

Order: catalog/taxonomy (read-only, low risk) -> questions/test series -> products/entitlements -> attempts/scoring -> payments last (highest risk, most tests first). For each service: write/keep a test of current behaviour, replace queries, compare outputs, delete the old SQL.

Patterns for your critical paths:

- **Never leak answers**: always use `select` explicitly for student-facing queries, omitting `correctAnswer` and `explanation` until submit.
- **Submit once**: `const r = await prisma.attempt.updateMany({ where:{ id, userId, status:"IN_PROGRESS", endsAt:{ gte: now } }, data:{ status:"COMPLETED", ... } }); if (r.count===0) throw ...`
- **Autosave**: `prisma.userAnswer.upsert({ where:{ attemptId_questionId:{...} }, ... })` (needs `@@unique([attemptId, questionId])`).
- **Idempotent payment fulfilment**: inside `prisma.$transaction`, insert `PaymentEvent` (unique `eventId`); catch Prisma error code `P2002` (unique violation) and return success without re-granting; then `upsert` the `Entitlement` (unique `[userId, productId]`).
- **Access check** in one function `canAccess(userId, testId)` using `entitlement.findFirst`.
- Lists: paginate with `take/skip` or cursor; use `include` deliberately to avoid N+1; add `@@index` for every filter used in hot queries (attempts by user, answers by attempt).
- Keep `$queryRaw` (tagged template only, never string concatenation) for analytics aggregates or full-text search; type the results.
- Long interactive transactions on serverless: keep them short; Neon pooled connections do not like long-held transactions.

## 7. Seeding

`prisma/seed.ts` loads taxonomy from `taxonomy.csv` (programs, subjects, topics) using `upsert` on slugs so it can run repeatedly (`npx prisma db seed`). Do not seed paid content or real users in production.

## 8. Vercel + Neon specifics

- Runtime uses pooled `DATABASE_URL` + adapter; migrations use `DIRECT_URL`.
- Build command: `prisma migrate deploy && next build` (or run migrations in CI and keep the build clean; CI is safer because a failed migration should not half-deploy).
- Use the Node runtime for Prisma routes unless you deliberately set up an edge-compatible adapter.
- Neon free-tier autosuspend causes first-query cold latency; acceptable for dev, consider always-on compute at launch.
- Add `connectionTimeoutMillis`/pool settings through the adapter if you see timeouts under load; load-test the test-submit endpoint.

## 9. CI and quality

- On every PR: `npx prisma validate`, `npx prisma generate`, `tsc --noEmit`, tests against a **Neon branch** or Docker Postgres with `migrate deploy`.
- Schema drift check: `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` (needs a shadow DB; fails if schema and migrations disagree).
- Backups: Neon point-in-time restore window plus a nightly `pg_dump` to S3; test a restore once.
- Add `prisma:studio` (`npx prisma studio`) for local inspection only; never expose it publicly.

## 10. Rollout checklist

- [ ] Audit table of raw vs Prisma usage
- [ ] Confirm/upgrade Prisma version; singleton client with adapter
- [ ] Neon branch of prod; baseline `0_init`; `migrate resolve --applied`
- [ ] Switch deploy to `migrate deploy`; remove `db push` from README/scripts
- [ ] Add taxonomy + test_series_questions migration with data copy from `questions.test_series_id`
- [ ] Hand-written partial indexes in migrations
- [ ] Convert services in the order in section 6, tests first
- [ ] Remove `pg` Pool usage once nothing imports it
- [ ] CI checks and a restore drill

## 11. Common pitfalls

- Importing `@prisma/client` after moving to the generated path -> type errors or two client copies.
- Creating `new PrismaClient()` in each route file -> connection exhaustion.
- Using the pooled URL for migrations -> migration failures/locks; use the direct URL.
- Editing an already-applied migration; always add a new one.
- Forgetting `prisma generate` on Vercel (use `postinstall`).
- Float for money; use integer paise.