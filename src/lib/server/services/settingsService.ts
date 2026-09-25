import 'server-only';
import { query, transaction } from '../db';
import type { PlatformSettings, User } from '@/types';
import { logAudit } from './auditService';

const DEFAULTS: PlatformSettings = { ocr_provider: 'tesseract', ai_provider: 'gemini', mcq_default_count: 20 };

/** Read at request time so switching providers needs no redeploy (Architecture doc §7). */
export async function getSettings(): Promise<PlatformSettings> {
  const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM platform_settings`);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ocr_provider: map.ocr_provider === 'ocrspace' ? 'ocrspace' : DEFAULTS.ocr_provider,
    ai_provider: map.ai_provider === 'groq' ? 'groq' : DEFAULTS.ai_provider,
    mcq_default_count: Number(map.mcq_default_count) || DEFAULTS.mcq_default_count,
  };
}

export async function updateSettings(admin: User, patch: Partial<PlatformSettings>) {
  await transaction(async (db) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      await query(
        `INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, String(value), admin.id],
        db,
      );
    }
    await logAudit(admin.id, 'SETTINGS_UPDATED', 'platform_settings', admin.id, patch, db);
  });
  return getSettings();
}

/** Which provider credentials exist in the environment — shown in the admin UI, never the secrets themselves. */
export function providerAvailability() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    ocrspace: Boolean(process.env.OCRSPACE_API_KEY),
    tesseract: true,
    s3: Boolean(process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}
