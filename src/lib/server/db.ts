import 'server-only';
import pg from 'pg';

// NUMERIC (1700) and BIGINT/COUNT (20) come back as strings by default; the values used here
// (money with 2 decimals, row counts) fit safely in a JS number.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

const globalForDb = globalThis as unknown as { __pgPool?: pg.Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  return new pg.Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): pg.Pool {
  // Reuse one pool across hot reloads in dev and across requests in production.
  if (!globalForDb.__pgPool) globalForDb.__pgPool = createPool();
  return globalForDb.__pgPool;
}

export type Queryable = Pick<pg.PoolClient, 'query'>;

/** Parameterized query helper — never build SQL with string concatenation of user input. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = getPool(),
): Promise<T | null> {
  const rows = await query<T>(text, params, db);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
