import { route, ok, readJson } from '@/lib/server/http';
import { requireAdmin } from '@/lib/server/session';
import { getSettings, updateSettings, providerAvailability } from '@/lib/server/services/settingsService';
import { settingsSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await requireAdmin();
  return ok({ settings: await getSettings(), availability: providerAvailability() });
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const settings = await updateSettings(admin, await readJson(req, settingsSchema));
  return ok({ settings, availability: providerAvailability() });
});
