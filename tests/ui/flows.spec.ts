import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

const FREE = '10000000-0000-4000-8000-000000000001';
const PAID = '10000000-0000-4000-8000-000000000003';

test.beforeAll(() => {
  execSync('node scripts/migrate.mjs --reset --seed', { stdio: 'pipe' });
});

async function devLogin(page: Page, email: string, path = '/login') {
  await page.goto(path);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Sign in (dev)' }).click();
}

test('guest browses landing, sample MCQ, catalog and detail CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Practice smarter');
  await expect(page.getByRole('link', { name: 'Explore Test Series' })).toBeVisible();
  await page.getByRole('radio', { name: /aPTT/ }).click();
  await expect(page.getByText('Correct.')).toBeVisible();

  await page.getByRole('link', { name: 'Explore Test Series' }).click();
  await expect(page).toHaveURL(/\/test-series$/);
  await expect(page.getByText('Obstetrics')).toHaveCount(0); // draft hidden
  await page.getByRole('link', { name: /Pharmacology Essentials/ }).click();
  await expect(page.getByTestId('series-cta')).toHaveText('Login to Unlock');

  await page.goto(`/test-series/${FREE}`);
  await expect(page.getByTestId('series-cta')).toHaveText('Login to Start');
});

test('private pages redirect guests to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('new student: login → complete profile → take free test → results → dashboard', async ({ page }) => {
  await devLogin(page, `ui-${Date.now()}@example.test`, `/login?next=${encodeURIComponent(`/tests/${FREE}`)}`);
  await expect(page).toHaveURL(/\/complete-profile/);
  await page.getByLabel(/Mobile number/).fill('12345');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText(/valid/i)).toBeVisible();
  await page.getByLabel(/Mobile number/).fill(`9${String(Date.now()).slice(-9)}`);
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await expect(page).toHaveURL(new RegExp(`/tests/${FREE}`));
  await page.getByTestId('begin-test').click();
  await expect(page.getByText('Question 1 of 6')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();

  await page.getByRole('radio').nth(1).click(); // B for Q1 (correct)
  await page.getByRole('button', { name: /Mark for review/ }).click();
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByText('Question 2 of 6')).toBeVisible();
  await page.keyboard.press('b'); // keyboard answer
  await page.getByRole('button', { name: 'Question 5' }).click();
  await expect(page.getByText('Question 5 of 6')).toBeVisible();
  await page.getByRole('radio').nth(0).click(); // A (wrong)

  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Answered')).toBeVisible();
  await dialog.getByTestId('confirm-submit').click();

  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByTestId('result-percentage')).toHaveText('33.3%');
  await expect(page.getByText('Question-wise review')).toBeVisible();
  await expect(page.getByText('Explanation:').first()).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.getByText('Tests completed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View result' })).toBeVisible();
});

test('student without purchase is sent to the unlock page, and cannot open admin', async ({ page }) => {
  await devLogin(page, 'student3@example.test');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/tests/${PAID}`);
  await expect(page).toHaveURL(new RegExp(`/unlock/${PAID}`));
  await expect(page.getByRole('button', { name: /Pay ₹199/ })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login\?error=forbidden/);
  await expect(page.getByText('does not have admin access')).toBeVisible();
});

test('admin: create series → add question → import → publish → visible to students', async ({ page }) => {
  await devLogin(page, 'admin@example.test', '/admin/login');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Revenue')).toBeVisible();

  await page.getByRole('link', { name: 'Test Series', exact: true }).click();
  await page.getByRole('link', { name: 'New test series' }).click();
  const title = `UI Series ${Date.now()}`;
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Duration (minutes)').fill('7');
  await page.getByRole('button', { name: 'Create and add questions' }).click();

  await expect(page).toHaveURL(/\/questions$/);
  await page.getByLabel('Question').fill('Which position eases dyspnoea?');
  for (const [l, v] of [['A', 'Prone'], ['B', 'Fowler’s'], ['C', 'Supine'], ['D', 'Trendelenburg']]) {
    await page.getByLabel(`Option ${l}`, { exact: true }).fill(v);
  }
  await page.getByLabel('B is correct').check();
  await page.getByRole('button', { name: 'Add question' }).last().click();
  await expect(page.getByText('Which position eases dyspnoea?')).toBeVisible();

  await page.getByRole('link', { name: 'Import questions' }).click();
  await page.getByRole('button', { name: 'Paste text / HTML' }).click();
  await page.getByLabel('Paste questions').fill('1. Antidote for opioids?\nA) Naloxone\nB) Flumazenil\nC) Atropine\nD) Protamine\nAnswer: A');
  await page.getByRole('button', { name: 'Parse and preview' }).click();
  await expect(page.getByText('Antidote for opioids?')).toBeVisible();
  await page.getByTestId('save-import').click();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByText('Antidote for opioids?')).toBeVisible();

  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();

  await page.goto('/test-series');
  await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
});

test('@mobile test runner is usable on a phone', async ({ page }) => {
  await devLogin(page, 'student1@example.test');
  await page.goto(`/tests/${FREE}`);
  await page.getByTestId('begin-test').click();
  await expect(page.getByText(/Question 1 of 6/)).toBeVisible();
  await page.getByRole('button', { name: 'All questions' }).click();
  await page.getByRole('button', { name: 'Question 3' }).click();
  await expect(page.getByText('Question 3 of 6')).toBeVisible();
});
