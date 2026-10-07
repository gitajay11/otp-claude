/**
 * Apply server/schema.sql to DATABASE_URL. Idempotent.
 *   npm run db:migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from '../src/db.js';

const schemaPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');

// Strip comments, split into statements (the HTTP driver runs one statement per query).
const statements = fs
  .readFileSync(schemaPath, 'utf8')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

await sql.transaction(statements.map((s) => sql.query(s)));
console.log(`[migrate] Applied ${statements.length} statements from schema.sql`);
