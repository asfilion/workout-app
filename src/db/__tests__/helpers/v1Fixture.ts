import type { DatabaseSync } from 'node:sqlite';

/**
 * A frozen copy of the schema as shipped, verbatim from schema.ts at the time
 * migrations were introduced. This represents what is actually on a phone today.
 *
 * It deliberately does NOT import schema.ts. If it did, the migration tests would
 * follow along with any future edit to that file and quietly stop testing the
 * upgrade path real installs take.
 */
const V1_SCHEMA = `
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
`;

export interface V1Data {
  exerciseIds: { squat: string; bench: string };
  templateId: string;
  completedSessionId: string;
  activeSessionId: string;
}

/**
 * Builds a populated v1 database: two exercises, one weekly template with two
 * days, a completed session with sets, and an in-flight active session.
 */
export function seedV1Database(raw: DatabaseSync): V1Data {
  raw.exec(V1_SCHEMA);

  const squat = 'ex-squat';
  const bench = 'ex-bench';
  const templateId = 'tpl-push-pull';
  const completedSessionId = 'ses-completed';
  const activeSessionId = 'ses-active';

  raw.exec(`
    INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES
      ('${squat}', 'Back Squat', 5, 0),
      ('${bench}', 'Bench Press', 8, 0);

    INSERT INTO workout_templates (id, name) VALUES ('${templateId}', 'Push Pull');

    INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds) VALUES
      ('day-mon', '${templateId}', 'Mon', '["${squat}","${bench}"]'),
      ('day-thu', '${templateId}', 'Thu', '["${bench}"]');

    INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt, status) VALUES
      ('${completedSessionId}', '${templateId}', 'Push Pull', 'Mon', '2026-07-20T17:00:00.000Z', '2026-07-20T18:00:00.000Z', 'completed'),
      ('${activeSessionId}', '${templateId}', 'Push Pull', 'Thu', '2026-07-26T17:00:00.000Z', NULL, 'active');

    INSERT INTO session_set_entries (id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps) VALUES
      ('set-1', '${completedSessionId}', '${squat}', 'Back Squat', '2026-07-20T17:10:00.000Z', 225, 5),
      ('set-2', '${completedSessionId}', '${squat}', 'Back Squat', '2026-07-20T17:15:00.000Z', 235, 3),
      ('set-3', '${completedSessionId}', '${bench}', 'Bench Press', '2026-07-20T17:30:00.000Z', 155, 8),
      ('set-4', '${activeSessionId}', '${bench}', 'Bench Press', '2026-07-26T17:05:00.000Z', 160, 6);
  `);

  return {
    exerciseIds: { squat, bench },
    templateId,
    completedSessionId,
    activeSessionId,
  };
}
