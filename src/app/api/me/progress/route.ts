import { route, ok } from '@/lib/server/http';
import { requireUser } from '@/lib/server/session';
import { progressForUser } from '@/lib/server/services/attemptService';

export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await progressForUser((await requireUser()).id)));
