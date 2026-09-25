'use client';

import { useState } from 'react';
import { Alert, Button, Card, Field, Input, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { PlatformSettings } from '@/types';

export function SettingsForm({ initial, availability }: { initial: PlatformSettings; availability: Record<string, boolean> }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await api<{ settings: PlatformSettings }>('/api/admin/settings', { method: 'PUT', json: values });
      setValues(res.settings);
      setStatus({ ok: true, msg: 'Settings saved.' });
    } catch (err) {
      setStatus({ ok: false, msg: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <Card className="space-y-5 p-6">
        <h2 className="font-sans text-sm font-semibold">Question generation</h2>
        <Field label="OCR engine (scanned PDFs)" htmlFor="ocr" hint="Tesseract runs on this server with no limits. OCR.space is often more accurate on poor scans (free tier, rate-limited).">
          <Select id="ocr" value={values.ocr_provider} onChange={(e) => setValues({ ...values, ocr_provider: e.target.value as PlatformSettings['ocr_provider'] })}>
            <option value="tesseract">Tesseract.js — free, unlimited, self-hosted (default)</option>
            <option value="ocrspace">OCR.space — free tier{availability.ocrspace ? '' : ' (using public demo key)'}</option>
          </Select>
        </Field>
        <Field label="MCQ generator" htmlFor="ai" hint="If the selected provider fails or hits its quota, the other one is tried automatically.">
          <Select id="ai" value={values.ai_provider} onChange={(e) => setValues({ ...values, ai_provider: e.target.value as PlatformSettings['ai_provider'] })}>
            <option value="gemini">Gemini Flash — free tier, best quality (default){availability.gemini ? '' : ' — not configured'}</option>
            <option value="groq">Groq (Llama) — free tier, fastest{availability.groq ? '' : ' — not configured'}</option>
          </Select>
        </Field>
        <Field label="Default number of questions per document" htmlFor="count">
          <Input id="count" type="number" min={1} max={100} value={values.mcq_default_count} onChange={(e) => setValues({ ...values, mcq_default_count: Number(e.target.value) })} className="w-32" />
        </Field>
        {status && <Alert tone={status.ok ? 'ok' : 'bad'}>{status.msg}</Alert>}
        <div className="flex justify-end border-t border-line pt-5"><Button type="submit" loading={busy}>Save settings</Button></div>
      </Card>
    </form>
  );
}
