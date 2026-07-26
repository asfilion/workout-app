import { runMigrations, LATEST_VERSION, MIGRATIONS, type Migration } from '../migrations';
import {
  createTestDatabase,
  getUserVersion,
  tableExists,
  columnNames,
  isNotNull,
  type TestDatabase,
} from './helpers/testDatabase';
import { seedV1Database, type V1Data } from './helpers/v1Fixture';

describe('runMigrations on a fresh install', () => {
  let ctx: TestDatabase;

  beforeEach(async () => {
    ctx = createTestDatabase();
    await runMigrations(ctx.db);
  });

  afterEach(() => ctx.close());

  it('stamps the database at the latest version', () => {
    expect(getUserVersion(ctx.raw)).toBe(LATEST_VERSION);
  });

  it('creates every table the app queries', () => {
    for (const table of [
      'exercises',
      'workout_templates',
      'workout_day_templates',
      'workout_sessions',
      'session_set_entries',
      'session_exercises',
    ]) {
      expect(tableExists(ctx.raw, table)).toBe(true);
    }
  });

  it('gives workout_templates a scheduleType', () => {
    expect(columnNames(ctx.raw, 'workout_templates')).toContain('scheduleType');
  });
});

describe('runMigrations on an existing v1 install', () => {
  let ctx: TestDatabase;
  let data: V1Data;

  beforeEach(async () => {
    ctx = createTestDatabase();
    data = seedV1Database(ctx.raw);
    // A shipped install has tables but has never been stamped.
    expect(getUserVersion(ctx.raw)).toBe(0);
    await runMigrations(ctx.db);
  });

  afterEach(() => ctx.close());

  it('upgrades to the latest version', () => {
    expect(getUserVersion(ctx.raw)).toBe(LATEST_VERSION);
  });

  it('preserves every logged set', () => {
    const rows = ctx.raw.prepare('SELECT * FROM session_set_entries ORDER BY id').all();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      id: 'set-1',
      sessionId: data.completedSessionId,
      exerciseNameSnapshot: 'Back Squat',
      weight: 225,
      reps: 5,
    });
  });

  it('preserves sessions, including the snapshot fields history depends on', () => {
    const rows = ctx.raw
      .prepare('SELECT * FROM workout_sessions ORDER BY startedAt')
      .all() as Record<string, unknown>[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: data.completedSessionId,
      workoutTemplateId: data.templateId,
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      status: 'completed',
      endedAt: '2026-07-20T18:00:00.000Z',
    });
  });

  it('preserves day templates and their exercise ordering', () => {
    const row = ctx.raw
      .prepare('SELECT * FROM workout_day_templates WHERE id = ?')
      .get('day-mon') as { dayOfWeek: string; orderedExerciseIds: string };
    expect(row.dayOfWeek).toBe('Mon');
    expect(JSON.parse(row.orderedExerciseIds)).toEqual([
      data.exerciseIds.squat,
      data.exerciseIds.bench,
    ]);
  });

  it('preserves exercises', () => {
    const rows = ctx.raw.prepare('SELECT * FROM exercises ORDER BY name').all();
    expect(rows).toHaveLength(2);
  });

  it('marks existing workouts as weekly', () => {
    const row = ctx.raw
      .prepare('SELECT scheduleType FROM workout_templates WHERE id = ?')
      .get(data.templateId) as { scheduleType: string };
    expect(row.scheduleType).toBe('weekly');
  });

  it('relaxes the NOT NULL constraints that blocked day-independent workouts', () => {
    expect(isNotNull(ctx.raw, 'workout_day_templates', 'dayOfWeek')).toBe(false);
    expect(isNotNull(ctx.raw, 'workout_sessions', 'dayOfWeek')).toBe(false);
    expect(isNotNull(ctx.raw, 'workout_sessions', 'workoutTemplateId')).toBe(false);
  });

  it('accepts a day-independent template and an ad hoc session after migrating', () => {
    ctx.raw.exec(`
      INSERT INTO workout_templates (id, name, scheduleType) VALUES ('tpl-solo', 'Arms', 'standalone');
      INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds)
        VALUES ('day-solo', 'tpl-solo', NULL, '[]');
      INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, status)
        VALUES ('ses-adhoc', NULL, 'Quick Workout', NULL, '2026-07-26T18:00:00.000Z', 'active');
    `);
    const row = ctx.raw
      .prepare('SELECT workoutTemplateId, dayOfWeek FROM workout_sessions WHERE id = ?')
      .get('ses-adhoc');
    expect(row).toMatchObject({ workoutTemplateId: null, dayOfWeek: null });
  });

  it('carries the in-flight session onto the new exercise list', () => {
    // The active session was on Thu, whose template day holds Bench Press only.
    // Without this the user's workout would come up empty mid-session.
    const rows = ctx.raw
      .prepare('SELECT * FROM session_exercises WHERE sessionId = ? ORDER BY position')
      .all(data.activeSessionId) as {
      exerciseId: string;
      exerciseNameSnapshot: string;
      position: number;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: data.exerciseIds.bench,
      exerciseNameSnapshot: 'Bench Press',
      position: 0,
    });
  });

  it('does not backfill finished sessions, whose record is their logged sets', () => {
    const rows = ctx.raw
      .prepare('SELECT * FROM session_exercises WHERE sessionId = ?')
      .all(data.completedSessionId);
    expect(rows).toHaveLength(0);
  });
});

describe('runMigrations safety', () => {
  let ctx: TestDatabase;

  beforeEach(() => {
    ctx = createTestDatabase();
  });

  afterEach(() => ctx.close());

  it('is a no-op when already at the latest version', async () => {
    seedV1Database(ctx.raw);
    await runMigrations(ctx.db);
    const before = ctx.raw.prepare('SELECT * FROM session_set_entries ORDER BY id').all();

    await runMigrations(ctx.db);

    expect(getUserVersion(ctx.raw)).toBe(LATEST_VERSION);
    expect(ctx.raw.prepare('SELECT * FROM session_set_entries ORDER BY id').all()).toEqual(before);
  });

  it('rolls back and leaves the version untouched when a migration throws', async () => {
    seedV1Database(ctx.raw);
    const failing: Migration[] = [
      ...MIGRATIONS,
      {
        version: LATEST_VERSION + 1,
        up: async (db) => {
          await db.execAsync('DELETE FROM session_set_entries');
          throw new Error('boom');
        },
      },
    ];

    await expect(runMigrations(ctx.db, failing)).rejects.toThrow('boom');

    expect(getUserVersion(ctx.raw)).toBe(LATEST_VERSION);
    expect(ctx.raw.prepare('SELECT COUNT(*) as c FROM session_set_entries').get()).toMatchObject({
      c: 4,
    });
  });
});
