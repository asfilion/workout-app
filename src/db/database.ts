import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { runMigrations } from './migrations';
import { createBackup, BACKUP_DB_NAME } from './backup';
import seedExercises from './seed-exercises.json';
import { type SeedExercise } from '../types';

export const DB_NAME = 'workout-tracker.db';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export function generateId(): string {
  return Crypto.randomUUID();
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  // Callers race on startup (App loads settings and the active session at once).
  // Share one in-flight open so setup never runs twice — a second seedIfEmpty
  // would insert duplicate exercises and trip the UNIQUE constraint on name.
  if (!opening) {
    opening = openAndPrepare().catch((err) => {
      opening = null;
      throw err;
    });
  }
  return opening;
}

async function openAndPrepare(): Promise<SQLite.SQLiteDatabase> {
  const connection = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await prepare(connection);
  } catch (err) {
    // Never cache a half-prepared connection: doing so hides the failure behind
    // a database that looks open but has no tables.
    await connection.closeAsync().catch(() => {});
    throw err;
  }
  db = connection;
  return connection;
}

async function prepare(connection: SQLite.SQLiteDatabase): Promise<void> {
  await runMigrations(connection);
  await seedIfEmpty(connection);
}

/**
 * Startup entry point. Resolves once the database is usable; rejects if it isn't,
 * so the UI can offer recovery rather than every screen throwing on first query.
 */
export async function initializeDatabase(): Promise<void> {
  const connection = await getDatabase();
  // A failed snapshot must never block a working app — the app is still usable,
  // it just isn't backed up yet, and the next launch will try again.
  await createBackup(connection).catch(() => {});
}

/**
 * Overwrite the live database with the snapshot, then bring it back up to the
 * current schema. Restoring an older snapshot is expected once migrations exist,
 * which is why prepare() runs again afterwards.
 */
export async function restoreFromBackup(): Promise<void> {
  if (db) {
    await db.closeAsync().catch(() => {});
  }
  db = null;
  opening = null;

  const dest = await SQLite.openDatabaseAsync(DB_NAME);
  const source = await SQLite.openDatabaseAsync(BACKUP_DB_NAME);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, destDatabase: dest });
  } finally {
    await source.closeAsync().catch(() => {});
  }

  try {
    await prepare(dest);
  } catch (err) {
    await dest.closeAsync().catch(() => {});
    throw err;
  }
  db = dest;
}

async function seedIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises'
  );
  if (result && result.count > 0) return;
  const exercises = seedExercises as SeedExercise[];
  for (const ex of exercises) {
    await database.runAsync(
      'INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES (?, ?, ?, 0)',
      [generateId(), ex.name, ex.recommendedMaxReps]
    );
  }
}
