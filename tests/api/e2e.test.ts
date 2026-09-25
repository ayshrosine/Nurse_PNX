/**
 * End-to-end API tests against a running app + real PostgreSQL (see README "Testing").
 * The database is reset to seed data before the suite runs.
 */
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, Client } from './client';

const SERIES = {
  fundamentals: '10000000-0000-4000-8000-000000000001', // free, published, 6 q
  medsurg: '10000000-0000-4000-8000-000000000002', // paid 199, published; student1 owns
  pharma: '10000000-0000-4000-8000-000000000003', // paid 199, published; student2 owns
  community: '10000000-0000-4000-8000-000000000004', // free, published
  obg: '10000000-0000-4000-8000-000000000005', // DRAFT, 4 q + 10 AI drafts
};
const STUDENT1_ID = '00000000-0000-4000-8000-000000000011';
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? 'mock_secret';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? 'whsec_mock';

const sign = (orderId: string, paymentId: string) => createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

async function webhook(payload: object, eventId: string, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(payload);
  return new Client().json('/api/payments/razorpay/webhook', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': createHmac('sha256', secret).update(raw).digest('hex'),
      'x-razorpay-event-id': eventId,
    },
  });
}

let guest: Client;
let admin: Client;
let s1: Client; // owns medsurg
let s3: Client; // failed medsurg purchase earlier

beforeAll(async () => {
  execSync('node scripts/migrate.mjs --reset --seed', { stdio: 'pipe' });
  guest = new Client();
  [admin, s1, s3] = await Promise.all([as('admin@example.test'), as('student1@example.test'), as('student3@example.test')]);
});

// ------------------------------------------------------------------ public
describe('public catalog', () => {
  it('health reports database ok', async () => {
    const r = await guest.get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.data.database).toBe('ok');
  });

  it('lists only PUBLISHED series with derived question counts and guest access states', async () => {
    const r = await guest.get('/api/test-series');
    expect(r.status).toBe(200);
    const ids = r.body.data.map((s: any) => s.id);
    expect(ids).not.toContain(SERIES.obg);
    expect(ids).toHaveLength(4);
    const fund = r.body.data.find((s: any) => s.id === SERIES.fundamentals);
    const med = r.body.data.find((s: any) => s.id === SERIES.medsurg);
    expect(fund).toMatchObject({ question_count: 6, access: 'FREE', has_access: false });
    expect(med).toMatchObject({ price: 199, access: 'LOGIN_REQUIRED', has_access: false });
    expect(fund).not.toHaveProperty('status');
  });

  it('computes access per viewer on the server', async () => {
    const r = await s1.get('/api/test-series');
    const byId = Object.fromEntries(r.body.data.map((s: any) => [s.id, s]));
    expect(byId[SERIES.medsurg]).toMatchObject({ access: 'PURCHASED', has_access: true });
    expect(byId[SERIES.pharma]).toMatchObject({ access: 'PURCHASE_REQUIRED', has_access: false });
    expect(byId[SERIES.fundamentals]).toMatchObject({ access: 'FREE', has_access: true });
  });

  it('hides drafts and rejects malformed ids with 404', async () => {
    expect((await guest.get(`/api/test-series/${SERIES.obg}`)).status).toBe(404);
    expect((await guest.get('/api/test-series/not-a-uuid')).status).toBe(404);
    expect((await guest.get(`/api/test-series/${SERIES.fundamentals}`)).status).toBe(200);
  });

  it('never trusts ?paid=true or ?role=ADMIN', async () => {
    const r = await guest.get(`/api/test-series/${SERIES.medsurg}?paid=true&role=ADMIN`);
    expect(r.body.data.has_access).toBe(false);
    expect((await guest.get('/api/admin/dashboard?role=ADMIN')).status).toBe(401);
  });

  it('renders public pages', async () => {
    for (const path of ['/', '/test-series', `/test-series/${SERIES.medsurg}`, '/login', '/admin/login']) {
      expect((await guest.raw(path)).status, path).toBe(200);
    }
  });
});

// ------------------------------------------------------------------ auth
describe('authentication & profile', () => {
  it('guest gets 401 on private APIs and redirects on private pages', async () => {
    expect((await guest.get('/api/auth/me')).body.data).toBeNull();
    for (const p of ['/api/me', '/api/me/attempts', '/api/me/purchases', '/api/me/progress']) {
      const r = await guest.get(p);
      expect(r.status, p).toBe(401);
      expect(r.body.error.code).toBe('UNAUTHORIZED');
    }
    expect((await guest.post(`/api/tests/${SERIES.fundamentals}/start`)).status).toBe(401);
    for (const p of ['/dashboard', '/profile', `/tests/${SERIES.fundamentals}`, '/admin']) {
      const res = await guest.raw(p);
      expect(res.status, p).toBe(307);
    }
  });

  it('first login creates a STUDENT without phone; phone is required before testing', async () => {
    const fresh = await as(`new-${Date.now()}@example.test`);
    const me = await fresh.get('/api/me');
    expect(me.body.data).toMatchObject({ role: 'STUDENT', phone: null });

    const start = await fresh.post(`/api/tests/${SERIES.fundamentals}/start`);
    expect(start.status).toBe(403);
    expect(start.body.error.code).toBe('PROFILE_INCOMPLETE');

    expect((await fresh.put('/api/me/profile', { phone: '12345' })).status).toBe(422);
    expect((await fresh.put('/api/me/profile', { phone: '9876501234', role: 'ADMIN' })).status).toBe(422);
    expect((await fresh.put('/api/me/profile', { phone: '+919800000011' })).status).toBe(409); // student1's number

    const ok = await fresh.put('/api/me/profile', { phone: '98765 01234' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ phone: '+919876501234', role: 'STUDENT' });
    expect((await fresh.post(`/api/tests/${SERIES.fundamentals}/start`)).status).toBe(200);
  });

  it('dev login refuses to create admins and recognises existing users', async () => {
    const me = await (await as('admin@example.test')).get('/api/auth/me');
    expect(me.body.data.role).toBe('ADMIN');
  });

  it('logout ends the session', async () => {
    const c = await as('student4@example.test');
    expect((await c.get('/api/me')).status).toBe(200);
    await c.post('/api/auth/logout');
    expect((await c.get('/api/me')).status).toBe(401);
  });
});

// ------------------------------------------------------------------ RBAC
describe('admin API protection', () => {
  const adminGets = ['/api/admin/dashboard', '/api/admin/users', `/api/admin/users/${ADMIN_ID}`, '/api/admin/test-series',
    `/api/admin/test-series/${SERIES.obg}`, `/api/admin/test-series/${SERIES.obg}/questions`, '/api/admin/purchases', '/api/admin/attempts', '/api/admin/settings'];

  it('401 for guests, 403 for students, 200 for admins', async () => {
    for (const p of adminGets) {
      expect((await guest.get(p)).status, `guest ${p}`).toBe(401);
      expect((await s1.get(p)).status, `student ${p}`).toBe(403);
      expect((await admin.get(p)).status, `admin ${p}`).toBe(200);
    }
  });

  it('students cannot mutate content', async () => {
    expect((await s1.post('/api/admin/test-series', { title: 'x', is_free: true, price: 0, duration_minutes: 5 })).status).toBe(403);
    expect((await s1.post(`/api/admin/test-series/${SERIES.obg}/publish`)).status).toBe(403);
    expect((await s1.patch(`/api/admin/users/${STUDENT1_ID}`, { status: 'SUSPENDED' })).status).toBe(403);
  });

  it('role is never writable through the API', async () => {
    const r = await admin.patch(`/api/admin/users/${STUDENT1_ID}`, { status: 'ACTIVE', role: 'ADMIN' });
    expect(r.status).toBe(422);
  });
});

// ------------------------------------------------------------------ test engine
describe('test engine', () => {
  let attemptId: string;
  let questionIds: string[];
  let key: Record<string, string>;

  it('start returns questions WITHOUT correct answers or explanations', async () => {
    const r = await s1.post(`/api/tests/${SERIES.fundamentals}/start`);
    expect(r.status).toBe(200);
    attemptId = r.body.data.attempt.id;
    questionIds = r.body.data.questions.map((q: any) => q.id);
    expect(questionIds).toHaveLength(6);
    const raw = JSON.stringify(r.body);
    expect(raw).not.toMatch(/correct_answer|explanation|is_correct/);
    expect(Object.keys(r.body.data.questions[0]).sort()).toEqual(['id', 'option_a', 'option_b', 'option_c', 'option_d', 'question_order', 'question_text']);
  });

  it('starting again resumes the same attempt', async () => {
    const r = await s1.post(`/api/tests/${SERIES.fundamentals}/start`);
    expect(r.body.data.attempt).toMatchObject({ id: attemptId, resumed: true });
  });

  it('autosave stores selections only for questions in the attempt', async () => {
    const qs = await admin.get(`/api/admin/test-series/${SERIES.fundamentals}/questions`);
    key = Object.fromEntries(qs.body.data.map((q: any) => [q.id, q.correct_answer]));
    const r = await s1.post(`/api/tests/${SERIES.fundamentals}/answers`, {
      attemptId,
      answers: [
        { questionId: questionIds[0], selectedAnswer: key[questionIds[0]] },
        { questionId: '00000000-0000-4000-8000-00000000ffff', selectedAnswer: 'A' },
      ],
    });
    expect(r.body.data.saved).toBe(1);
  });

  it('another student cannot submit or autosave this attempt', async () => {
    const other = await as('student2@example.test');
    expect((await other.post(`/api/tests/${SERIES.fundamentals}/submit`, { attemptId, answers: [] })).status).toBe(404);
    expect((await other.post(`/api/tests/${SERIES.fundamentals}/answers`, { attemptId, answers: [] })).status).toBe(404);
  });

  it('submit scores server-side and ignores client-supplied scores', async () => {
    // Q1 comes from autosave; Q2, Q3 correct; Q4 wrong; Q5, Q6 unanswered.
    const wrong = (id: string) => (['A', 'B', 'C', 'D'].find((l) => l !== key[id]) as string);
    const r = await s1.post(`/api/tests/${SERIES.fundamentals}/submit`, {
      attemptId,
      score: 999,
      percentage: 100,
      answers: [
        { questionId: questionIds[1], selectedAnswer: key[questionIds[1]], isCorrect: true },
        { questionId: questionIds[2], selectedAnswer: key[questionIds[2]] },
        { questionId: questionIds[3], selectedAnswer: wrong(questionIds[3]), isCorrect: true },
      ],
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ score: 3, total: 6, correct: 3, incorrect: 1, unanswered: 2, percentage: 50 });
  });

  it('a submitted attempt cannot be submitted again', async () => {
    const r = await s1.post(`/api/tests/${SERIES.fundamentals}/submit`, { attemptId, answers: [] });
    expect(r.status).toBe(409);
  });

  it('results: owner and admin can read (with review), others cannot', async () => {
    const mine = await s1.get(`/api/results/${attemptId}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toMatchObject({ percentage: 50, correct_answers: 3, status: 'COMPLETED' });
    expect(mine.body.data.review).toHaveLength(6);
    expect(mine.body.data.review[0]).toHaveProperty('correct_answer');
    expect((await admin.get(`/api/results/${attemptId}`)).status).toBe(200);
    expect((await s3.get(`/api/results/${attemptId}`)).status).toBe(403);
    expect((await guest.get(`/api/results/${attemptId}`)).status).toBe(401);
    expect((await s3.raw(`/results/${attemptId}`)).status).toBe(200); // page renders a "not yours" state, no data
  });

  it('progress and attempts reflect the new result', async () => {
    const p = await s1.get('/api/me/progress');
    expect(p.body.data.tests_completed).toBe(3); // 2 seeded + 1 new
    const a = await s1.get('/api/me/attempts');
    expect(a.body.data[0]).toMatchObject({ id: attemptId, status: 'COMPLETED' });
  });

  it('paid tests require a SUCCESS purchase', async () => {
    const denied = await s3.post(`/api/tests/${SERIES.pharma}/start`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('PURCHASE_REQUIRED');
    expect((await s1.post(`/api/tests/${SERIES.medsurg}/start`)).status).toBe(200);
    expect((await s1.post(`/api/tests/${SERIES.obg}/start`)).status).toBe(404); // draft
  });
});

// ------------------------------------------------------------------ payments
describe('payments (Razorpay)', () => {
  let orderId: string;
  let purchaseId: string;

  it('creates a PENDING purchase with the amount taken from the database', async () => {
    const r = await s3.post('/api/payments/razorpay/order', { testSeriesId: SERIES.pharma, amount: 1 });
    expect(r.status).toBe(201);
    expect(r.body.data.razorpay).toMatchObject({ amount: 19900, currency: 'INR', keyId: expect.stringMatching(/^rzp_/) });
    expect(r.body.data.purchase).toMatchObject({ status: 'PENDING', amount: 199 });
    orderId = r.body.data.razorpay.orderId;
    purchaseId = r.body.data.purchase.id;
  });

  it('reuses the pending order instead of creating duplicates', async () => {
    const r = await s3.post('/api/purchases/create', { testSeriesId: SERIES.pharma });
    expect(r.body.data.razorpay.orderId).toBe(orderId);
  });

  it('rejects orders for free or already-owned series', async () => {
    expect((await s3.post('/api/payments/razorpay/order', { testSeriesId: SERIES.fundamentals })).status).toBe(409);
    expect((await s1.post('/api/payments/razorpay/order', { testSeriesId: SERIES.medsurg })).status).toBe(409);
    expect((await s1.post('/api/payments/razorpay/order', { testSeriesId: SERIES.obg })).status).toBe(404);
  });

  it('a forged signature never grants access', async () => {
    const r = await s3.post('/api/payments/razorpay/verify', {
      razorpay_order_id: orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'a'.repeat(64),
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PAYMENT_VERIFICATION_FAILED');
    expect((await s3.post(`/api/tests/${SERIES.pharma}/start`)).status).toBe(403);
  });

  it('another user cannot verify or read this order', async () => {
    const r = await s1.post('/api/payments/razorpay/verify', {
      razorpay_order_id: orderId, razorpay_payment_id: 'pay_x', razorpay_signature: sign(orderId, 'pay_x'),
    });
    expect(r.status).toBe(404);
    expect((await s1.get(`/api/purchases/${purchaseId}`)).status).toBe(403);
  });

  it('a valid signature marks SUCCESS and unlocks the test', async () => {
    const r = await s3.post('/api/payments/razorpay/verify', {
      razorpay_order_id: orderId, razorpay_payment_id: 'pay_ok_1', razorpay_signature: sign(orderId, 'pay_ok_1'),
    });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('SUCCESS');
    expect((await s3.get(`/api/purchases/${purchaseId}`)).body.data).toMatchObject({ status: 'SUCCESS', payment_id: 'pay_ok_1' });
    expect((await s3.post(`/api/tests/${SERIES.pharma}/start`)).status).toBe(200);
  });

  it('dismissed checkout cancels only the caller’s own pending order', async () => {
    const s4 = await as('student4@example.test');
    const order = await s4.post('/api/payments/razorpay/order', { testSeriesId: SERIES.medsurg });
    const id = order.body.data.razorpay.orderId;
    expect((await s1.post('/api/payments/razorpay/cancel', { orderId: id })).status).toBe(404);
    const r = await s4.post('/api/payments/razorpay/cancel', { orderId: id });
    expect(r.body.data.status).toBe('CANCELLED');
  });

  describe('webhook', () => {
    let s5: Client;
    let webhookOrder: string;

    beforeAll(async () => {
      s5 = await as('student5@example.test');
      await s5.put('/api/me/profile', { phone: '9811122233' });
      const o = await s5.post('/api/payments/razorpay/order', { testSeriesId: SERIES.pharma });
      webhookOrder = o.body.data.razorpay.orderId;
    });

    const captured = (orderId: string, amount = 19900, pay = 'pay_wh_1') => ({
      event: 'payment.captured',
      payload: { payment: { entity: { id: pay, order_id: orderId, amount, status: 'captured' } } },
    });

    it('rejects bad signatures', async () => {
      const r = await webhook(captured(webhookOrder), 'evt_bad', 'wrong_secret');
      expect(r.status).toBe(401);
    });

    it('ignores captures whose amount does not match the purchase', async () => {
      const r = await webhook(captured(webhookOrder, 100), 'evt_amount');
      expect(r.body.data).toMatchObject({ handled: false });
      expect((await s5.post(`/api/tests/${SERIES.pharma}/start`)).status).toBe(403);
    });

    it('payment.captured marks SUCCESS even if the browser never called verify', async () => {
      const r = await webhook(captured(webhookOrder), 'evt_ok');
      expect(r.body.data).toMatchObject({ handled: true, duplicate: false });
      expect((await s5.post(`/api/tests/${SERIES.pharma}/start`)).status).toBe(200);
    });

    it('is idempotent on replayed events', async () => {
      const r = await webhook(captured(webhookOrder), 'evt_ok');
      expect(r.body.data.duplicate).toBe(true);
    });

    it('refund.processed revokes access but keeps the record', async () => {
      const r = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_1', payment_id: 'pay_wh_1', amount: 19900 } } } }, 'evt_refund');
      expect(r.body.data.handled).toBe(true);
      const start = await s5.post(`/api/tests/${SERIES.pharma}/start`);
      expect(start.status).toBe(403);
      const mine = await s5.get('/api/me/purchases');
      expect(mine.body.data.find((p: any) => p.order_id === webhookOrder)).toMatchObject({ status: 'REFUNDED', amount: 199 });
    });
  });
});

// ------------------------------------------------------------------ admin CMS
describe('admin content management', () => {
  let seriesId: string;
  const q = (n: number, answer = 'B') => ({
    question_text: `Admin question ${n}?`, option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd', correct_answer: answer, explanation: `why ${n}`,
  });

  it('validates test series input', async () => {
    expect((await admin.post('/api/admin/test-series', { title: 'x', is_free: true, price: 50, duration_minutes: 10 })).status).toBe(422);
    expect((await admin.post('/api/admin/test-series', { title: '', is_free: true, price: 0, duration_minutes: 10 })).status).toBe(422);
    expect((await admin.post('/api/admin/test-series', { title: 'x', is_free: false, price: 99, duration_minutes: 0 })).status).toBe(422);
  });

  it('creates a draft and refuses to publish it without questions', async () => {
    const r = await admin.post('/api/admin/test-series', { title: 'E2E Paid Series', description: 'd', is_free: false, price: 149, duration_minutes: 5, instructions: 'Go' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'DRAFT', question_count: 0 });
    seriesId = r.body.data.id;
    expect((await admin.post(`/api/admin/test-series/${seriesId}/publish`)).status).toBe(409);
  });

  it('adds, validates, edits and reorders questions', async () => {
    expect((await admin.post(`/api/admin/test-series/${seriesId}/questions`, q(0, 'E'))).status).toBe(422);
    expect((await admin.post(`/api/admin/test-series/${seriesId}/questions`, { ...q(0), option_c: '' })).status).toBe(422);
    const a = await admin.post(`/api/admin/test-series/${seriesId}/questions`, q(1));
    const b = await admin.post(`/api/admin/test-series/${seriesId}/questions`, q(2, 'C'));
    expect(a.status).toBe(201);
    const edited = await admin.put(`/api/admin/questions/${a.body.data.id}`, { ...q(1), correct_answer: 'd' });
    expect(edited.body.data.correct_answer).toBe('D');
    const bad = await admin.post(`/api/admin/test-series/${seriesId}/questions/reorder`, { questionIds: [a.body.data.id] });
    expect(bad.status).toBe(422);
    await admin.post(`/api/admin/test-series/${seriesId}/questions/reorder`, { questionIds: [b.body.data.id, a.body.data.id] });
    const list = await admin.get(`/api/admin/test-series/${seriesId}/questions`);
    expect(list.body.data.map((x: any) => x.question_text)).toEqual(['Admin question 2?', 'Admin question 1?']);
  });

  it('structured HTML import: preview (sanitised) then save', async () => {
    const html = `<h1>Mock</h1><script>fetch('/steal')</script>
      <p>1. <b>Which</b> vitamin is given at birth?</p><p>A) Vitamin A</p><p>B) Vitamin K</p><p>C) Vitamin C</p><p>D) Vitamin D</p><p>Answer: B</p>
      <p>2. Broken question</p><p>A) only one option</p><p>Answer: A</p>`;
    const preview = await admin.post(`/api/admin/test-series/${seriesId}/import/html`, { html });
    expect(preview.status).toBe(200);
    expect(preview.body.data.questions).toHaveLength(1);
    expect(preview.body.data.issues).toHaveLength(1);
    expect(JSON.stringify(preview.body)).not.toMatch(/<script|<b>|steal/);
    const saved = await admin.post(`/api/admin/test-series/${seriesId}/import/save`, { questions: preview.body.data.questions, filename: 'pasted.html' });
    expect(saved.body.data.imported).toBe(1);
    expect((await admin.get(`/api/admin/test-series/${seriesId}`)).body.data.question_count).toBe(3);
  });

  it('file import accepts CSV and rejects disallowed file types', async () => {
    const form = new FormData();
    form.append('file', new Blob(['question,option_a,option_b,option_c,option_d,correct_answer\nCSV q?,a,b,c,d,A\n'], { type: 'text/csv' }), 'q.csv');
    const ok = await admin.json(`/api/admin/test-series/${seriesId}/import/html`, { method: 'POST', body: form });
    expect(ok.body.data.questions).toHaveLength(1);
    const bad = new FormData();
    bad.append('file', new Blob(['MZ...'], { type: 'application/octet-stream' }), 'evil.exe');
    expect((await admin.json(`/api/admin/test-series/${seriesId}/import/html`, { method: 'POST', body: bad })).status).toBe(415);
  });

  it('publish → visible publicly with no frontend change; student can buy it', async () => {
    const p = await admin.post(`/api/admin/test-series/${seriesId}/publish`);
    expect(p.body.data.status).toBe('PUBLISHED');
    const list = await guest.get('/api/test-series');
    expect(list.body.data.find((s: any) => s.id === seriesId)).toMatchObject({ question_count: 3, price: 149 });
    const order = await s1.post('/api/payments/razorpay/order', { testSeriesId: seriesId });
    const o = order.body.data.razorpay.orderId;
    await s1.post('/api/payments/razorpay/verify', { razorpay_order_id: o, razorpay_payment_id: 'pay_e2e', razorpay_signature: sign(o, 'pay_e2e') });
  });

  it('price edits never change historical purchase amounts', async () => {
    const current = (await admin.get(`/api/admin/test-series/${seriesId}`)).body.data;
    const r = await admin.put(`/api/admin/test-series/${seriesId}`, {
      title: current.title, description: current.description, is_free: false, price: 299, duration_minutes: 5, instructions: current.instructions, status: 'PUBLISHED',
    });
    expect(r.body.data.price).toBe(299);
    const purchases = await admin.get(`/api/admin/purchases?testSeriesId=${seriesId}`);
    expect(purchases.body.data.items[0]).toMatchObject({ amount: 149, status: 'SUCCESS' });
  });

  it('answered questions cannot be deleted; unpublish keeps history; delete with history is refused', async () => {
    const start = await s1.post(`/api/tests/${seriesId}/start`);
    const qids = start.body.data.questions.map((x: any) => x.id);
    await s1.post(`/api/tests/${seriesId}/submit`, { attemptId: start.body.data.attempt.id, answers: qids.map((id: string) => ({ questionId: id, selectedAnswer: 'B' })) });
    expect((await admin.del(`/api/admin/questions/${qids[0]}`)).status).toBe(409);

    await admin.post(`/api/admin/test-series/${seriesId}/unpublish`);
    expect((await guest.get(`/api/test-series/${seriesId}`)).status).toBe(404);
    expect((await s1.post(`/api/tests/${seriesId}/start`)).status).toBe(404);
    expect((await s1.get('/api/me/attempts')).body.data.some((a: any) => a.test_series_id === seriesId)).toBe(true);

    await admin.post(`/api/admin/test-series/${seriesId}/archive`);
    expect((await admin.get(`/api/admin/test-series/${seriesId}`)).body.data.status).toBe('ARCHIVED');
    expect((await admin.del(`/api/admin/test-series/${seriesId}`)).status).toBe(409);
  });

  it('empty series can be deleted', async () => {
    const r = await admin.post('/api/admin/test-series', { title: 'Temp', is_free: true, price: 0, duration_minutes: 5 });
    expect((await admin.del(`/api/admin/test-series/${r.body.data.id}`)).status).toBe(200);
    expect((await admin.get(`/api/admin/test-series/${r.body.data.id}`)).status).toBe(404);
  });
});

// ------------------------------------------------------------------ document pipeline
describe('document → MCQ pipeline', () => {
  async function waitFor(id: string, statuses: string[]) {
    for (let i = 0; i < 60; i++) {
      const d = await admin.get(`/api/admin/documents/${id}`);
      if (statuses.includes(d.body.data.status)) return d.body.data;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('timeout waiting for document status');
  }

  it('rejects files whose content does not match the extension', async () => {
    const form = new FormData();
    form.append('testSeriesId', SERIES.obg);
    form.append('file', new Blob(['not really a pdf'], { type: 'application/pdf' }), 'fake.pdf');
    expect((await admin.json('/api/admin/documents/upload', { method: 'POST', body: form })).status).toBe(415);
    expect((await s1.json('/api/admin/documents/upload', { method: 'POST', body: form })).status).toBe(403);
  });

  it('upload → extract → parse → review → reject one → approve', async () => {
    const before = (await admin.get(`/api/admin/test-series/${SERIES.obg}`)).body.data.question_count;
    const html = `<html><body><h1>Postnatal notes</h1><script>alert(1)</script>
      <p>1. Lochia rubra lasts about:</p><p>A) 1–3 days</p><p>B) 2 weeks</p><p>C) 6 weeks</p><p>D) 3 months</p><p>Answer: A</p>
      <p>2. Oxytocin is responsible for:</p><p>A) Milk production</p><p>B) Milk ejection</p><p>C) Ovulation</p><p>D) Lactation suppression</p><p>Answer: B</p>
      <p>3. Colostrum is rich in:</p><p>A) Fat</p><p>B) Lactose</p><p>C) Antibodies</p><p>D) Iron</p><p>Answer: C</p></body></html>`;
    const form = new FormData();
    form.append('testSeriesId', SERIES.obg);
    form.append('file', new Blob([html], { type: 'text/html' }), 'postnatal.html');
    const up = await admin.json('/api/admin/documents/upload', { method: 'POST', body: form });
    expect(up.status).toBe(201);
    const id = up.body.data.id;

    expect((await admin.post(`/api/admin/documents/${id}/extract`)).status).toBe(202);
    const extracted = await waitFor(id, ['EXTRACTED', 'EXTRACT_FAILED']);
    expect(extracted.status).toBe('EXTRACTED');
    expect(extracted.text_preview).toContain('Lochia rubra');
    expect(extracted.text_preview).not.toContain('alert');

    expect((await admin.post(`/api/admin/documents/${id}/generate`, { mode: 'parse' })).status).toBe(202);
    const generated = await waitFor(id, ['GENERATED', 'GENERATE_FAILED']);
    expect(generated.status).toBe('GENERATED');

    const drafts = (await admin.get(`/api/admin/documents/${id}/preview`)).body.data;
    expect(drafts).toHaveLength(3);
    expect(drafts.every((d: any) => d.review_status === 'PENDING_REVIEW' && d.source === 'AI_GENERATED')).toBe(true);
    // Drafts never count or show for students.
    expect((await admin.get(`/api/admin/test-series/${SERIES.obg}`)).body.data.question_count).toBe(before);

    await admin.post(`/api/admin/questions/${drafts[2].id}/review`, { status: 'REJECTED' });
    const approved = await admin.post(`/api/admin/documents/${id}/approve`);
    expect(approved.body.data.approved).toBe(2);
    expect((await admin.get(`/api/admin/test-series/${SERIES.obg}`)).body.data.question_count).toBe(before + 2);
    expect((await admin.get(`/api/admin/documents/${id}`)).body.data.status).toBe('APPROVED');
  });

  it('AI generation without API keys fails gracefully with a message', async () => {
    if (process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) return;
    const form = new FormData();
    form.append('testSeriesId', SERIES.obg);
    form.append('file', new Blob(['<html><body><p>' + 'Magnesium sulphate is used in eclampsia. '.repeat(10) + '</p></body></html>'], { type: 'text/html' }), 'notes.html');
    const id = (await admin.json('/api/admin/documents/upload', { method: 'POST', body: form })).body.data.id;
    await admin.post(`/api/admin/documents/${id}/extract`);
    await waitFor(id, ['EXTRACTED']);
    await admin.post(`/api/admin/documents/${id}/generate`, { mode: 'ai', count: 5 });
    const doc = await waitFor(id, ['GENERATE_FAILED', 'GENERATED']);
    expect(doc.status).toBe('GENERATE_FAILED');
    expect(doc.error_message).toMatch(/not configured/);
    expect((await admin.del(`/api/admin/documents/${id}`)).status).toBe(200);
  });
});

// ------------------------------------------------------------------ admin reporting
describe('admin reporting', () => {
  it('dashboard revenue = sum of SUCCESS purchases only', async () => {
    const d = (await admin.get('/api/admin/dashboard')).body.data.stats;
    const all = (await admin.get('/api/admin/purchases?pageSize=100')).body.data.items;
    const expected = all.filter((p: any) => p.status === 'SUCCESS').reduce((n: number, p: any) => n + p.amount, 0);
    expect(d.revenue).toBe(expected);
    expect(all.some((p: any) => p.status !== 'SUCCESS')).toBe(true);
  });

  it('users: search, filter, paginate, detail', async () => {
    const r = await admin.get('/api/admin/users?q=kulkarni');
    expect(r.body.data.items).toHaveLength(1);
    expect(r.body.data.items[0].email).toBe('student3@example.test');
    const paged = await admin.get('/api/admin/users?pageSize=2&page=2&role=STUDENT');
    expect(paged.body.data).toMatchObject({ page: 2, pageSize: 2 });
    expect(paged.body.data.items).toHaveLength(2);
    const detail = await admin.get(`/api/admin/users/${STUDENT1_ID}`);
    expect(detail.body.data.user.email).toBe('student1@example.test');
    expect(detail.body.data.progress.tests_completed).toBeGreaterThan(0);
  });

  it('SQL injection in filters is inert', async () => {
    const r = await admin.get(`/api/admin/users?q=${encodeURIComponent("' OR 1=1 --")}`);
    expect(r.status).toBe(200);
    expect(r.body.data.items).toHaveLength(0);
    expect((await admin.get('/api/admin/purchases?status=SUCCESS%27%3B%20DROP%20TABLE%20users')).status).toBe(422);
  });

  it('attempts list and detail', async () => {
    const list = await admin.get('/api/admin/attempts?status=COMPLETED');
    expect(list.body.data.items.every((a: any) => a.status === 'COMPLETED')).toBe(true);
    const detail = await admin.get(`/api/admin/attempts/${list.body.data.items[0].id}`);
    expect(detail.body.data.review.length).toBeGreaterThan(0);
  });

  it('suspending a user blocks their existing session immediately', async () => {
    const s2 = await as('student2@example.test');
    const id = (await s2.get('/api/me')).body.data.id;
    await admin.patch(`/api/admin/users/${id}`, { status: 'SUSPENDED' });
    expect((await s2.get('/api/me')).status).toBe(401);
    await admin.patch(`/api/admin/users/${id}`, { status: 'ACTIVE' });
    expect((await s2.get('/api/me')).status).toBe(200);
    expect((await admin.patch(`/api/admin/users/${ADMIN_ID}`, { status: 'SUSPENDED' })).status).toBe(409);
  });

  it('settings validate providers and persist', async () => {
    expect((await admin.put('/api/admin/settings', { ai_provider: 'openai' })).status).toBe(422);
    const r = await admin.put('/api/admin/settings', { ai_provider: 'groq', mcq_default_count: 15 });
    expect(r.body.data.settings).toMatchObject({ ai_provider: 'groq', mcq_default_count: 15 });
    await admin.put('/api/admin/settings', { ai_provider: 'gemini', mcq_default_count: 20 });
  });
});
