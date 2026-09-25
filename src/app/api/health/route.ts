import { query } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await query('SELECT 1');
    return Response.json({ success: true, data: { status: 'ok', database: 'ok' } });
  } catch {
    return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }, { status: 503 });
  }
}
