import { Card, Badge } from '@/components/ui';
import { AdminHeader } from '@/components/admin/shared';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { getSettings, providerAvailability } from '@/lib/server/services/settingsService';
import { storageBackend } from '@/lib/server/storage';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const settings = await getSettings();
  const availability = providerAvailability();
  const integrations: [string, boolean, string][] = [
    ['Google sign-in', availability.google, 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET'],
    ['Razorpay payments', availability.razorpay, 'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET'],
    ['Razorpay webhook', availability.razorpayWebhook, 'RAZORPAY_WEBHOOK_SECRET'],
    ['S3-Compatible Object Storage', availability.s3, `AWS_* (currently using ${storageBackend() === 's3' ? 'S3' : 'local disk — development only'})`],
    ['Gemini', availability.gemini, 'GEMINI_API_KEY'],
    ['Groq', availability.groq, 'GROQ_API_KEY'],
    ['OCR.space', availability.ocrspace, 'OCRSPACE_API_KEY (optional)'],
  ];
  return (
    <div className="max-w-3xl space-y-6">
      <AdminHeader title="Settings" description="Platform-wide defaults. Changes apply immediately — no redeploy needed." />
      <SettingsForm initial={settings} availability={availability} />
      <Card className="p-6">
        <h2 className="font-sans text-sm font-semibold">Integrations</h2>
        <p className="mt-1 text-sm text-muted">Configured through server environment variables. Secret values are never shown here.</p>
        <ul className="mt-4 divide-y divide-line text-sm">
          {integrations.map(([name, ok, vars]) => (
            <li key={name} className="flex items-center justify-between gap-4 py-2.5">
              <div><div className="font-medium">{name}</div><div className="text-xs text-muted">{vars}</div></div>
              <Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'Configured' : 'Not configured'}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
