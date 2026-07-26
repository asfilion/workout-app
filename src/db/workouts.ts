import { getDatabase, generateId } from './database';
import {
  type WorkoutTemplate,
  type WorkoutDayTemplate,
  type DayOfWeek,
  type ScheduleType,
} from '../types';

interface DayRow {
  id: string;
  workoutTemplateId: string;
  dayOfWeek: DayOfWeek | null;
  orderedExerciseIds: string;
}

function toDayTemplate(row: DayRow): WorkoutDayTemplate {
  return { ...row, orderedExerciseIds: JSON.parse(row.orderedExerciseIds) };
}

export async function getAllWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutTemplate>('SELECT * FROM workout_templates ORDER BY name');
}

export async function getStandaloneTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutTemplate>(
    "SELECT * FROM workout_templates WHERE scheduleType = 'standalone' ORDER BY name"
  );
}

export async function getWorkoutTemplateById(id: string): Promise<WorkoutTemplate | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutTemplate>('SELECT * FROM workout_templates WHERE id = ?', [id]);
}

/**
 * A standalone workout gets its single day-independent list immediately, so
 * every caller can assume the row exists rather than creating it on first edit.
 */
export async function createWorkoutTemplate(
  name: string,
  scheduleType: ScheduleType = 'weekly'
): Promise<WorkoutTemplate> {
  const db = await getDatabase();
  const id = generateId();
  const trimmed = name.trim();
  await db.runAsync('INSERT INTO workout_templates (id, name, scheduleType) VALUES (?, ?, ?)', [
    id,
    trimmed,
    scheduleType,
  ]);
  if (scheduleType === 'standalone') {
    await db.runAsync(
      'INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds) VALUES (?, ?, NULL, ?)',
      [generateId(), id, '[]']
    );
  }
  return { id, name: trimmed, scheduleType };
}

export async function updateWorkoutTemplateName(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE workout_templates SET name = ? WHERE id = ?', [name.trim(), id]);
}

/**
 * Sessions are detached rather than deleted — `workoutNameSnapshot` is what
 * history displays, so the record survives the template it came from.
 */
export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE workout_sessions SET workoutTemplateId = NULL WHERE workoutTemplateId = ?', [id]);
    await db.runAsync('DELETE FROM workout_day_templates WHERE workoutTemplateId = ?', [id]);
    await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);
  });
}

export async function getDaysForTemplate(workoutTemplateId: string): Promise<WorkoutDayTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DayRow>(
    `SELECT * FROM workout_day_templates WHERE workoutTemplateId = ? ORDER BY CASE dayOfWeek
     WHEN 'Mon' THEN 1 WHEN 'Tue' THEN 2 WHEN 'Wed' THEN 3 WHEN 'Thu' THEN 4
     WHEN 'Fri' THEN 5 WHEN 'Sat' THEN 6 WHEN 'Sun' THEN 7 ELSE 8 END`,
    [workoutTemplateId]
  );
  return rows.map(toDayTemplate);
}

/** The day-independent list, or null if this template doesn't have one. */
export async function getStandaloneDay(
  workoutTemplateId: string
): Promise<WorkoutDayTemplate | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DayRow>(
    'SELECT * FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek IS NULL',
    [workoutTemplateId]
  );
  return row ? toDayTemplate(row) : null;
}

/**
 * Pass `dayOfWeek: null` for a standalone workout's list. The lookup branches
 * because `dayOfWeek = NULL` never matches in SQL — using `=` would silently
 * insert a new row on every edit instead of updating the existing one.
 */
export async function upsertWorkoutDay(
  workoutTemplateId: string,
  dayOfWeek: DayOfWeek | null,
  orderedExerciseIds: string[]
): Promise<WorkoutDayTemplate> {
  const db = await getDatabase();
  const existing = dayOfWeek
    ? await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek = ?',
        [workoutTemplateId, dayOfWeek]
      )
    : await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek IS NULL',
        [workoutTemplateId]
      );

  const idsJson = JSON.stringify(orderedExerciseIds);
  if (existing) {
    await db.runAsync('UPDATE workout_day_templates SET orderedExerciseIds = ? WHERE id = ?', [
      idsJson,
      existing.id,
    ]);
    return { id: existing.id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
  }

  const id = generateId();
  await db.runAsync(
    'INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds) VALUES (?, ?, ?, ?)',
    [id, workoutTemplateId, dayOfWeek, idsJson]
  );
  return { id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
}

/**
 * Standalone workouts are excluded for free: their dayOfWeek is NULL, which
 * never matches `=`.
 */
export async function getWorkoutDaysForToday(
  dayOfWeek: DayOfWeek
): Promise<(WorkoutDayTemplate & { workoutName: string })[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DayRow & { workoutName: string }>(
    `SELECT wdt.*, wt.name as workoutName FROM workout_day_templates wdt
     JOIN workout_templates wt ON wdt.workoutTemplateId = wt.id WHERE wdt.dayOfWeek = ?`,
    [dayOfWeek]
  );
  return rows.map((r) => ({ ...toDayTemplate(r), workoutName: r.workoutName }));
}
