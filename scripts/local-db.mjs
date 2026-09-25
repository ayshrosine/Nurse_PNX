// Runs a real PostgreSQL server locally (no Docker/installation needed) for development and tests.
// Keep it running in its own terminal. Connection string:
//   postgresql://postgres:postgres@localhost:5433/nursing_level_up
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.join(root, '.local-db');
const port = Number(process.env.LOCAL_DB_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();
// Explicit UTF8: on Windows initdb otherwise defaults to WIN1252, which rejects characters like "−" or "₹".
const admin = pg.getPgClient();
await admin.connect();
const { rows } = await admin.query(
  `SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = 'nursing_level_up'`,
);
if (rows[0] && rows[0].enc !== 'UTF8') {
  await admin.query('DROP DATABASE nursing_level_up');
  rows.length = 0;
}
if (!rows[0]) {
  await admin.query(
    `CREATE DATABASE nursing_level_up ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
}
await admin.end();
console.log(`✓ PostgreSQL running: postgresql://postgres:postgres@localhost:${port}/nursing_level_up`);
console.log('  Press Ctrl+C to stop.');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
