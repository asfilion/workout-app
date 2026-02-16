import { getDatabase, generateId } from './database';
import { type WorkoutTemplate, type WorkoutDayTemplate, type DayOfWeek } from '../types';

export async function getAllWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutTemplate>('SELECT * FROM workout_templates ORDER BY name');
}

export async function getWorkoutTemplateById(id: string): Promise<WorkoutTemplate | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutTemplate>('SELECT * FROM workout_templates WHERE id = ?', [id]);
}

export async function createWorkoutTemplate(name: string): Promise<WorkoutTemplate> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync('INSERT INTO workout_templates (id, name) VALUES (?, ?)', [id, name.trim()]);
  return { id, name: name.trim() };
}

export async function updateWorkoutTemplateName(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE workout_templates SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_day_templates WHERE workoutTemplateId = ?', [id]);
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);
}

export async function getDaysForTemplate(workoutTemplateId: string): Promise<WorkoutDayTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; workoutTemplateId: string; dayOfWeek: DayOfWeek; orderedExerciseIds: string }>(
    `SELECT * FROM workout_day_templates WHERE workoutTemplateId = ? ORDER BY CASE dayOfWeek
     WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4
     WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7 END`,
    [workoutTemplateId]
  );
  return rows.map(r => ({ ...r, orderedExerciseIds: JSON.parse(r.orderedExerciseIds) }));
}

export async function upsertWorkoutDay(
  workoutTemplateId: string, dayOfWeek: DayOfWeek, orderedExerciseIds: string[]
): Promise<WorkoutDayTemplate> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek = ?',
    [workoutTemplateId, dayOfWeek]
  );
  const idsJson = JSON.stringify(orderedExerciseIds);
  if (existing) {
    await db.runAsync('UPDATE workout_day_templates SET orderedExerciseIds = ? WHERE id = ?', [idsJson, existing.id]);
    return { id: existing.id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
  }
  const id = generateId();
  await db.runAsync(
    'INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds) VALUES (?, ?, ?, ?)',
    [id, workoutTemplateId, dayOfWeek, idsJson]
  );
  return { id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
}

export async function getWorkoutDaysForToday(dayOfWeek: DayOfWeek): Promise<(WorkoutDayTemplate & { workoutName: string })[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; workoutTemplateId: string; dayOfWeek: DayOfWeek; orderedExerciseIds: string; workoutName: string }>(
    `SELECT wdt.*, wt.name as workoutName FROM workout_day_templates wdt
     JOIN workout_templates wt ON wdt.workoutTemplateId = wt.id WHERE wdt.dayOfWeek = ?`,
    [dayOfWeek]
  );
  return rows.map(r => ({ ...r, orderedExerciseIds: JSON.parse(r.orderedExerciseIds) }));
}
