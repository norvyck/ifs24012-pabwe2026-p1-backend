import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = process.env.VERCEL
  ? '/tmp/truthcheck.db'
  : path.join(currentDirectory, '..', 'data', 'truthcheck.db');

const databasePath = path.resolve(
  process.env.DATABASE_PATH || defaultDbPath,
);

mkdirSync(path.dirname(databasePath), { recursive: true });

const bunRuntime = typeof Bun !== 'undefined';
let database;

if (bunRuntime) {
  const { Database } = await import('bun:sqlite');
  database = new Database(databasePath, { create: true, strict: true });
} else {
  const { DatabaseSync } = await import('node:sqlite');
  database = new DatabaseSync(databasePath);
}

export const db = {
  exec: (sql) => database.exec(sql),
  query: (sql) => {
    if (bunRuntime) return database.query(sql);

    const statement = database.prepare(sql);
    return {
      get: (...values) => statement.get(...values),
      all: (...values) => statement.all(...values),
      run: (...values) => {
        try {
          return statement.run(...values);
        } catch (error) {
          if (error.errcode === 2067) {
            throw Object.assign(new Error(error.message, { cause: error }), {
              code: 'SQLITE_CONSTRAINT_UNIQUE',
            });
          }
          throw error;
        }
      },
    };
  },
  transaction: (callback) => {
    if (bunRuntime) return database.transaction(callback);

    return () => {
      database.exec('BEGIN');
      try {
        const result = callback();
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    };
  },
  close: () => database.close(),
};

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_url TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('benar', 'salah', 'menyesatkan')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (claim_id, user_id)
  );
`);

const seedIfEmpty = db.transaction(() => {
  if (db.query('SELECT COUNT(*) AS total FROM users').get().total > 0) return;

  const insertUser = db.query(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
  );
  const passwordHash = bcrypt.hashSync('password123', 10);
  const aniId = Number(insertUser.run('Ani Contoh', 'ani@example.com', passwordHash).lastInsertRowid);
  const budiId = Number(insertUser.run('Budi Contoh', 'budi@example.com', passwordHash).lastInsertRowid);

  const claimResult = db.query(`
    INSERT INTO claims (title, description, source_url, created_by)
    VALUES (?, ?, ?, ?)
  `).run(
    'Contoh klaim tentang konsumsi air',
    'Klaim contoh untuk mencoba API TruthCheck.',
    'https://example.com/artikel',
    aniId,
  );
  const claimId = Number(claimResult.lastInsertRowid);

  db.query(`
    INSERT INTO claims (title, description, created_by)
    VALUES (?, ?, ?)
  `).run('Contoh klaim kedua', 'Klaim contoh lain untuk pengembangan lokal.', budiId);

  db.query(`
    INSERT INTO evidence (claim_id, user_id, content, source_url)
    VALUES (?, ?, ?, ?)
  `).run(
    claimId,
    budiId,
    'Ini adalah bukti contoh untuk klaim.',
    'https://example.com/sumber',
  );
  db.query(`
    INSERT INTO votes (claim_id, user_id, vote_type)
    VALUES (?, ?, ?)
  `).run(claimId, budiId, 'benar');
});

seedIfEmpty();
