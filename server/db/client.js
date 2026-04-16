import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = join(fileURLToPath(import.meta.url), '../..');

export const db = createClient({
  url: process.env.DATABASE_URL ?? 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function migrate() {
  const migrationsDir = join(__dirname, '..', 'migrations');

  // Track applied migrations so each file runs exactly once
  await db.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER)`
  );
  const appliedRows = await db.execute('SELECT name FROM _migrations');
  const applied = new Set(appliedRows.rows.map(r => String(r.name)));

  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({
      sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
      args: [file, Date.now()],
    });
    console.log(`[db] applied ${file}`);
  }
}
