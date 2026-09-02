import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations.');

const migrationsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();
const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const appliedRows = await sql<{ name: string }[]>`select name from schema_migrations order by name`;
  const applied = new Set(appliedRows.map((row) => row.name));
  const pending = files.filter((file) => !applied.has(file));
  if (process.argv.includes('--check')) {
    if (pending.length) throw new Error(`Pending migrations: ${pending.join(', ')}`);
  } else {
    for (const file of pending) {
      const source = await readFile(resolve(migrationsDirectory, file), 'utf8');
      await sql.begin(async (transaction) => {
        await transaction.unsafe(source);
        await transaction`insert into schema_migrations (name) values (${file})`;
      });
      console.log(`Applied ${file}`);
    }
  }
} finally {
  await sql.end();
}
