import { getDatabase, generateId } from './database';
import { type Exercise } from '../types';

export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; recommendedMaxReps: number; isArchived: number }>(
    'SELECT * FROM exercises WHERE isArchived = 0 ORDER BY name COLLATE NOCASE'
  );
  return rows.map(r => ({ ...r, isArchived: r.isArchived === 1 }));
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string; name: string; recommendedMaxReps: number; isArchived: number }>(
    'SELECT * FROM exercises WHERE id = ?', [id]
  );
  if (!row) return null;
  return { ...row, isArchived: row.isArchived === 1 };
}

export async function createExercise(name: string, recommendedMaxReps: number): Promise<Exercise> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES (?, ?, ?, 0)',
    [id, name.trim(), recommendedMaxReps]
  );
  return { id, name: name.trim(), recommendedMaxReps, isArchived: false };
}

export async function archiveExercise(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE exercises SET isArchived = 1 WHERE id = ?', [id]);
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
}

export async function exerciseHasHistory(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM session_set_entries WHERE exerciseId = ?', [id]
  );
  return (result?.count ?? 0) > 0;
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; name: string; recommendedMaxReps: number; isArchived: number }>(
    'SELECT * FROM exercises WHERE isArchived = 0 AND name LIKE ? ORDER BY name COLLATE NOCASE',
    [`%${query}%`]
  );
  return rows.map(r => ({ ...r, isArchived: r.isArchived === 1 }));
}
