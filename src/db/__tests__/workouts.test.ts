jest.mock('../database', () => ({ getDatabase: jest.fn(), generateId: jest.fn() }));

import * as databaseModule from '../database';
import {
  createWorkoutTemplate,
  getAllWorkoutTemplates,
  getStandaloneTemplates,
  getDaysForTemplate,
  getStandaloneDay,
  upsertWorkoutDay,
  getWorkoutDaysForToday,
  deleteWorkoutTemplate,
} from '../workouts';
import { createMigratedDatabase, attach, type MockedDatabaseModule } from './helpers/queryHarness';
import type { TestDatabase } from './helpers/testDatabase';

const mocked = databaseModule as unknown as MockedDatabaseModule;

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createMigratedDatabase();
  attach(mocked, ctx);
});

afterEach(() => ctx.close());

describe('createWorkoutTemplate', () => {
  it('defaults to a weekly workout with no days yet', async () => {
    const template = await createWorkoutTemplate('Push Pull');

    expect(template.scheduleType).toBe('weekly');
    expect(await getDaysForTemplate(template.id)).toHaveLength(0);
  });

  it('gives a standalone workout its single day-independent list up front', async () => {
    const template = await createWorkoutTemplate('Arms', 'standalone');

    expect(template.scheduleType).toBe('standalone');
    const days = await getDaysForTemplate(template.id);
    expect(days).toHaveLength(1);
    expect(days[0].dayOfWeek).toBeNull();
    expect(days[0].orderedExerciseIds).toEqual([]);
  });

  it('trims the name', async () => {
    const template = await createWorkoutTemplate('  Legs  ');
    expect(template.name).toBe('Legs');
  });
});

describe('listing templates', () => {
  beforeEach(async () => {
    await createWorkoutTemplate('Weekly Split');
    await createWorkoutTemplate('Arms', 'standalone');
    await createWorkoutTemplate('Conditioning', 'standalone');
  });

  it('returns every template regardless of schedule type', async () => {
    expect(await getAllWorkoutTemplates()).toHaveLength(3);
  });

  it('can list just the day-independent ones', async () => {
    const standalone = await getStandaloneTemplates();
    expect(standalone.map((t) => t.name)).toEqual(['Arms', 'Conditioning']);
  });
});

describe('upsertWorkoutDay', () => {
  it('creates then updates a weekday list without duplicating the row', async () => {
    const template = await createWorkoutTemplate('Push Pull');

    await upsertWorkoutDay(template.id, 'Mon', ['ex-a']);
    await upsertWorkoutDay(template.id, 'Mon', ['ex-a', 'ex-b']);

    const days = await getDaysForTemplate(template.id);
    expect(days).toHaveLength(1);
    expect(days[0].orderedExerciseIds).toEqual(['ex-a', 'ex-b']);
  });

  it('updates the day-independent list in place rather than adding rows', async () => {
    // `dayOfWeek = NULL` never matches with `=`, so the lookup has to use IS NULL
    // or a standalone workout would grow a new row on every edit.
    const template = await createWorkoutTemplate('Arms', 'standalone');

    await upsertWorkoutDay(template.id, null, ['ex-curl']);
    await upsertWorkoutDay(template.id, null, ['ex-curl', 'ex-pushdown']);

    const days = await getDaysForTemplate(template.id);
    expect(days).toHaveLength(1);
    expect(days[0].orderedExerciseIds).toEqual(['ex-curl', 'ex-pushdown']);
  });

  it('keeps weekday and day-independent lists separate on the same template', async () => {
    const template = await createWorkoutTemplate('Hybrid');

    await upsertWorkoutDay(template.id, 'Mon', ['ex-a']);
    await upsertWorkoutDay(template.id, null, ['ex-z']);

    const days = await getDaysForTemplate(template.id);
    expect(days).toHaveLength(2);
  });
});

describe('getStandaloneDay', () => {
  it('returns the day-independent list for a standalone template', async () => {
    const template = await createWorkoutTemplate('Arms', 'standalone');
    await upsertWorkoutDay(template.id, null, ['ex-curl']);

    const day = await getStandaloneDay(template.id);
    expect(day?.orderedExerciseIds).toEqual(['ex-curl']);
  });

  it('returns null for a weekly template', async () => {
    const template = await createWorkoutTemplate('Push Pull');
    await upsertWorkoutDay(template.id, 'Mon', ['ex-a']);

    expect(await getStandaloneDay(template.id)).toBeNull();
  });
});

describe('getWorkoutDaysForToday', () => {
  it('finds the weekly workouts scheduled for that day', async () => {
    const template = await createWorkoutTemplate('Push Pull');
    await upsertWorkoutDay(template.id, 'Mon', ['ex-a']);

    const today = await getWorkoutDaysForToday('Mon');
    expect(today).toHaveLength(1);
    expect(today[0].workoutName).toBe('Push Pull');
  });

  it('never surfaces day-independent workouts, which belong to no day', async () => {
    const standalone = await createWorkoutTemplate('Arms', 'standalone');
    await upsertWorkoutDay(standalone.id, null, ['ex-curl']);

    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const) {
      expect(await getWorkoutDaysForToday(day)).toHaveLength(0);
    }
  });
});

describe('deleteWorkoutTemplate', () => {
  it('removes the template and its days', async () => {
    const template = await createWorkoutTemplate('Push Pull');
    await upsertWorkoutDay(template.id, 'Mon', ['ex-a']);

    await deleteWorkoutTemplate(template.id);

    expect(await getAllWorkoutTemplates()).toHaveLength(0);
    expect(await getDaysForTemplate(template.id)).toHaveLength(0);
  });

  it('keeps past sessions and detaches them, since the name snapshot is the record', async () => {
    const template = await createWorkoutTemplate('Push Pull');
    ctx.raw.exec(`
      INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt, status)
      VALUES ('ses-1', '${template.id}', 'Push Pull', 'Mon', '2026-07-20T17:00:00.000Z', '2026-07-20T18:00:00.000Z', 'completed');
    `);

    await deleteWorkoutTemplate(template.id);

    const session = ctx.raw
      .prepare('SELECT workoutTemplateId, workoutNameSnapshot FROM workout_sessions WHERE id = ?')
      .get('ses-1');
    expect(session).toMatchObject({
      workoutTemplateId: null,
      workoutNameSnapshot: 'Push Pull',
    });
  });
});
