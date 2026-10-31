// Usage: node scripts/run-sql.js ../db/schema.sql
// Runs a .sql file against DATABASE_URL (handy on Windows or anywhere psql isn't installed).
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const file = process.argv[2];
if (!file) {
  console.error('Pass the path of a .sql file');
  process.exit(1);
}

try {
  const sql = await readFile(file, 'utf8');
  await pool.query(sql);
  console.log(`Ran ${file}`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
