import { type SQLiteDatabase } from 'expo-sqlite';

export async function createTables(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      recommendedMaxReps INTEGER NOT NULL,
      isArchived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workout_day_templates (
      id TEXT PRIMARY KEY NOT NULL,
      workoutTemplateId TEXT NOT NULL,
      dayOfWeek TEXT NOT NULL,
      orderedExerciseIds TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
    );
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      workoutTemplateId TEXT NOT NULL,
      workoutNameSnapshot TEXT NOT NULL,
      dayOfWeek TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
    );
    CREATE TABLE IF NOT EXISTS session_set_entries (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      exerciseId TEXT NOT NULL,
      exerciseNameSnapshot TEXT NOT NULL,
      loggedAt TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES workout_sessions(id),
      FOREIGN KEY (exerciseId) REFERENCES exercises(id)
    );
  `);
}
