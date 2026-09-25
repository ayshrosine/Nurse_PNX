import { route, ok } from '@/lib/server/http';
import { getCurrentUser } from '@/lib/server/session';
import { listPublished } from '@/lib/server/services/testSeriesService';

export const dynamic = 'force-dynamic';

/** Public catalog: PUBLISHED only, with the viewer's access state computed server-side. */
export const GET = route(async () => ok(await listPublished(await getCurrentUser())));
