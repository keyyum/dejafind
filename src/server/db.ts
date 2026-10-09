import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as sqliteVec from "sqlite-vec";

export const EMBEDDING_DIMS = 768;

declare global {
  var __dejafindDb: Database.Database | undefined;
}

export function dataDir(): string {
  const dir = process.env.DEJAFIND_DATA_DIR ?? join(process.cwd(), "data");
  if (!existsSync(/* turbopackIgnore: true */ dir)) mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  return dir;
}

export function watchDir(): string {
  const dir = join(dataDir(), "watch");
  if (!existsSync(/* turbopackIgnore: true */ dir)) mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  return dir;
}

export function derivedDir(): string {
  const dir = join(dataDir(), "derived");
  if (!existsSync(/* turbopackIgnore: true */ dir)) mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  return dir;
}

function dbPath(): string {
  return join(dataDir(), "dejafind.sqlite");
}

function migrate(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      doc_type TEXT,
      sha256 TEXT NOT NULL UNIQUE,
      captured_at TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      subject_id TEXT,
      text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'queued',
      thumb_path TEXT,
      clean_path TEXT,
      width INTEGER,
      height INTEGER,
      pages INTEGER NOT NULL DEFAULT 1,
      read_ms INTEGER,
      filed_at TEXT,
      error TEXT,
      schedule_section TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_idx ON subjects (name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      room TEXT,
      section TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule_pending (
      document_id TEXT PRIMARY KEY,
      section TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      idx INTEGER NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id);

    CREATE TABLE IF NOT EXISTS dates (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      iso_date TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      confidence REAL NOT NULL DEFAULT 0,
      span TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'review'
    );
    CREATE INDEX IF NOT EXISTS dates_document_idx ON dates (document_id);

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      citations TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      document_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  sqliteVec.load(db);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text);
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
      embedding FLOAT[${EMBEDDING_DIMS}] distance_metric=cosine
    );
  `);
}

export function getDb(): Database.Database {
  if (globalThis.__dejafindDb) return globalThis.__dejafindDb;
  const db = new Database(dbPath());
  migrate(db);
  globalThis.__dejafindDb = db;
  return db;
}

export function serializeVector(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}
