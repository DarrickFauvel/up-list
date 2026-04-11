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
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    console.log(`[db] applied ${file}`);
  }
}
