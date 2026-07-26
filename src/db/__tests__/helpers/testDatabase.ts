import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Presents expo-sqlite's async surface over node:sqlite, so migrations can be
 * exercised against real SQLite in plain Node — same engine, same SQL semantics,
 * no native module and no device.
 *
 * The cast to SQLiteDatabase is deliberate and confined to this file: only the
 * handful of methods the migration runner actually calls are implemented.
 *
 * One deliberate divergence from the device: node:sqlite enforces foreign keys
 * by default and expo-sqlite does not. We leave enforcement on, so the tests are
 * stricter than production. Migrations that survive here survive either way, and
 * we stop depending on an expo-sqlite default we don't control.
 */
export interface TestDatabase {
  db: SQLiteDatabase;
  raw: DatabaseSync;
  close: () => void;
}

type Params = unknown[];

// Callers use both db.runAsync(sql, [a, b]) and db.runAsync(sql, a, b).
function normalize(params: Params): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

export function createTestDatabase(): TestDatabase {
  const raw = new DatabaseSync(':memory:');

  const adapter = {
    execAsync: async (source: string) => {
      raw.exec(source);
    },
    runAsync: async (source: string, ...params: Params) => {
      const result = raw.prepare(source).run(...(normalize(params) as never[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (source: string, ...params: Params) => {
      // node:sqlite returns undefined for no rows; expo-sqlite returns null.
      return raw.prepare(source).get(...(normalize(params) as never[])) ?? null;
    },
    getAllAsync: async (source: string, ...params: Params) => {
      return raw.prepare(source).all(...(normalize(params) as never[]));
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
    closeAsync: async () => {
      raw.close();
    },
  };

  return {
    db: adapter as unknown as SQLiteDatabase,
    raw,
    close: () => raw.close(),
  };
}

export function getUserVersion(raw: DatabaseSync): number {
  const row = raw.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version;
}

export function tableExists(raw: DatabaseSync, name: string): boolean {
  const row = raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row !== undefined;
}

export function columnNames(raw: DatabaseSync, table: string): string[] {
  const rows = raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

/** True when the column is declared NOT NULL. */
export function isNotNull(raw: DatabaseSync, table: string, column: string): boolean {
  const rows = raw.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
    notnull: number;
  }[];
  return rows.find((r) => r.name === column)?.notnull === 1;
}
