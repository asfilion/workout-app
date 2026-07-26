import { getDatabase, generateId } from './database';
import {
  type WorkoutSession,
  type SessionSetEntry,
  type SessionExercise,
  type DayOfWeek,
  type SessionStatus,
} from '../types';

export interface SessionExerciseInput {
  exerciseId: string;
  exerciseNameSnapshot: string;
}

export interface StartSessionInput {
  /** null for an ad hoc workout with no template behind it. */
  workoutTemplateId: string | null;
  workoutNameSnapshot: string;
  /** null for ad hoc and standalone workouts. */
  dayOfWeek: DayOfWeek | null;
  exercises: SessionExerciseInput[];
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE status = 'active' LIMIT 1"
  );
}

/**
 * The exercise list is copied onto the session rather than looked up through the
 * template on every read. That is what lets a session exist without a template
 * or a weekday, and it keeps a workout in progress stable while its template is
 * edited.
 *
 * Session and list are written together: a half-started session with no
 * exercises would occupy the single active slot and block starting another.
 */
export async function startSession(input: StartSessionInput): Promise<WorkoutSession> {
  const db = await getDatabase();
  const id = generateId();
  const startedAt = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, input.workoutTemplateId, input.workoutNameSnapshot, input.dayOfWeek, startedAt, 'active']
    );
    for (let position = 0; position < input.exercises.length; position++) {
      const exercise = input.exercises[position];
      await db.runAsync(
        'INSERT INTO session_exercises (id, sessionId, exerciseId, exerciseNameSnapshot, position) VALUES (?, ?, ?, ?, ?)',
        [generateId(), id, exercise.exerciseId, exercise.exerciseNameSnapshot, position]
      );
    }
  });

  return {
    id,
    workoutTemplateId: input.workoutTemplateId,
    workoutNameSnapshot: input.workoutNameSnapshot,
    dayOfWeek: input.dayOfWeek,
    startedAt,
    endedAt: null,
    status: 'active',
  };
}

export async function endSession(id: string, status: 'completed' | 'canceled'): Promise<void> {
  const db = await getDatabase();
  const endedAt = new Date().toISOString();
  await db.runAsync('UPDATE workout_sessions SET status = ?, endedAt = ? WHERE id = ?', [
    status,
    endedAt,
    id,
  ]);
}

export async function getSessionExercises(sessionId: string): Promise<SessionExercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<SessionExercise>(
    'SELECT * FROM session_exercises WHERE sessionId = ? ORDER BY position ASC',
    [sessionId]
  );
}

export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
  exerciseNameSnapshot: string
): Promise<SessionExercise> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ next: number | null }>(
    'SELECT MAX(position) + 1 as next FROM session_exercises WHERE sessionId = ?',
    [sessionId]
  );
  const position = row?.next ?? 0;
  const id = generateId();
  await db.runAsync(
    'INSERT INTO session_exercises (id, sessionId, exerciseId, exerciseNameSnapshot, position) VALUES (?, ?, ?, ?, ?)',
    [id, sessionId, exerciseId, exerciseNameSnapshot, position]
  );
  return { id, sessionId, exerciseId, exerciseNameSnapshot, position };
}

/**
 * Removes the exercise from the session's list. Sets already logged against it
 * stay — they happened, and the exercise snapshot on each set is their record.
 */
export async function removeSessionExercise(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ sessionId: string; position: number }>(
      'SELECT sessionId, position FROM session_exercises WHERE id = ?',
      [id]
    );
    if (!row) return;
    await db.runAsync('DELETE FROM session_exercises WHERE id = ?', [id]);
    await db.runAsync(
      'UPDATE session_exercises SET position = position - 1 WHERE sessionId = ? AND position > ?',
      [row.sessionId, row.position]
    );
  });
}

export async function reorderSessionExercises(
  sessionId: string,
  orderedIds: string[]
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let position = 0; position < orderedIds.length; position++) {
      await db.runAsync(
        'UPDATE session_exercises SET position = ? WHERE id = ? AND sessionId = ?',
        [position, orderedIds[position], sessionId]
      );
    }
  });
}

export async function logSet(
  sessionId: string,
  exerciseId: string,
  exerciseNameSnapshot: string,
  weight: number,
  reps: number
): Promise<SessionSetEntry> {
  const db = await getDatabase();
  const id = generateId();
  const loggedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO session_set_entries (id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps]
  );
  return { id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps };
}

/**
 * Corrects a mistyped set. `loggedAt` is deliberately untouched: it is when the
 * set happened, not when it was edited, and history is ordered by it.
 */
export async function updateSet(id: string, weight: number, reps: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE session_set_entries SET weight = ?, reps = ? WHERE id = ?', [
    weight,
    reps,
    id,
  ]);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM session_set_entries WHERE id = ?', [id]);
}

export async function getSetsForSession(sessionId: string): Promise<SessionSetEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<SessionSetEntry>(
    'SELECT * FROM session_set_entries WHERE sessionId = ? ORDER BY loggedAt ASC',
    [sessionId]
  );
}

export async function getLastSetForExercise(exerciseId: string): Promise<SessionSetEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SessionSetEntry>(
    'SELECT * FROM session_set_entries WHERE exerciseId = ? ORDER BY loggedAt DESC LIMIT 1',
    [exerciseId]
  );
}

export async function getHistoryForExercise(
  exerciseId: string
): Promise<(SessionSetEntry & { workoutName: string; dayOfWeek: DayOfWeek | null })[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT sse.*, ws.workoutNameSnapshot as workoutName, ws.dayOfWeek
     FROM session_set_entries sse JOIN workout_sessions ws ON sse.sessionId = ws.id
     WHERE sse.exerciseId = ? ORDER BY sse.loggedAt DESC`,
    [exerciseId]
  );
}

export async function getAllSetsForExport(): Promise<
  {
    sessionId: string;
    sessionStatus: SessionStatus;
    workoutName: string;
    dayOfWeek: DayOfWeek | null;
    sessionStartedAt: string;
    sessionEndedAt: string | null;
    setLoggedAt: string;
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
  }[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT ws.id as sessionId, ws.status as sessionStatus, ws.workoutNameSnapshot as workoutName,
       ws.dayOfWeek, ws.startedAt as sessionStartedAt, ws.endedAt as sessionEndedAt,
       sse.loggedAt as setLoggedAt, sse.exerciseId, sse.exerciseNameSnapshot as exerciseName,
       sse.weight, sse.reps
     FROM session_set_entries sse JOIN workout_sessions ws ON sse.sessionId = ws.id
     ORDER BY sse.loggedAt DESC`
  );
}
