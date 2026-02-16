import { getDatabase, generateId } from './database';
import { type WorkoutSession, type SessionSetEntry, type DayOfWeek, type SessionStatus } from '../types';

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutSession>("SELECT * FROM workout_sessions WHERE status = 'active' LIMIT 1");
}

export async function startSession(
  workoutTemplateId: string, workoutNameSnapshot: string, dayOfWeek: DayOfWeek
): Promise<WorkoutSession> {
  const db = await getDatabase();
  const id = generateId();
  const startedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, 'active']
  );
  return { id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt: null, status: 'active' };
}

export async function endSession(id: string, status: 'completed' | 'canceled'): Promise<void> {
  const db = await getDatabase();
  const endedAt = new Date().toISOString();
  await db.runAsync('UPDATE workout_sessions SET status = ?, endedAt = ? WHERE id = ?', [status, endedAt, id]);
}

export async function logSet(
  sessionId: string, exerciseId: string, exerciseNameSnapshot: string, weight: number, reps: number
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

export async function getSetsForSession(sessionId: string): Promise<SessionSetEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<SessionSetEntry>('SELECT * FROM session_set_entries WHERE sessionId = ? ORDER BY loggedAt ASC', [sessionId]);
}

export async function getLastSetForExercise(exerciseId: string): Promise<SessionSetEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SessionSetEntry>(
    'SELECT * FROM session_set_entries WHERE exerciseId = ? ORDER BY loggedAt DESC LIMIT 1', [exerciseId]
  );
}

export async function getHistoryForExercise(exerciseId: string): Promise<(SessionSetEntry & { workoutName: string; dayOfWeek: string })[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT sse.*, ws.workoutNameSnapshot as workoutName, ws.dayOfWeek
     FROM session_set_entries sse JOIN workout_sessions ws ON sse.sessionId = ws.id
     WHERE sse.exerciseId = ? ORDER BY sse.loggedAt DESC`, [exerciseId]
  );
}

export async function getAllSetsForExport(): Promise<{
  sessionId: string; sessionStatus: SessionStatus; workoutName: string; dayOfWeek: string;
  sessionStartedAt: string; sessionEndedAt: string | null; setLoggedAt: string;
  exerciseId: string; exerciseName: string; weight: number; reps: number;
}[]> {
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
