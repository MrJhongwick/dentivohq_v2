import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Database = NeonQueryFunction<false, false>;

export function createDatabase(databaseUrl: string): Database {
  return neon(databaseUrl);
}
