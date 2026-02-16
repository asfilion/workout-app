import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { createTables } from './schema';
import seedExercises from './seed-exercises.json';
import { type SeedExercise } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export function generateId(): string {
  return Crypto.randomUUID();
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('workout-tracker.db');
  await createTables(db);
  await seedIfEmpty(db);
  return db;
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
