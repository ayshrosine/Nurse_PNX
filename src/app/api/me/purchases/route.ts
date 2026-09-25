import { route, ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { listForUser } from '@/lib/server/services/purchaseService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await listForUser((await requireUser()).id)));
