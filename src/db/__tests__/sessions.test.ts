jest.mock('../database', () => ({ getDatabase: jest.fn(), generateId: jest.fn() }));

import * as databaseModule from '../database';
import {
  startSession,
  getActiveSession,
  endSession,
  logSet,
  getSetsForSession,
  updateSet,
  deleteSet,
  getSessionExercises,
  addSessionExercise,
  removeSessionExercise,
  reorderSessionExercises,
  getHistoryForExercise,
  getAllSetsForExport,
} from '../sessions';
import { createMigratedDatabase, attach, type MockedDatabaseModule } from './helpers/queryHarness';
import type { TestDatabase } from './helpers/testDatabase';

const mocked = databaseModule as unknown as MockedDatabaseModule;

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createMigratedDatabase();
  attach(mocked, ctx);
  ctx.raw.exec(`
    INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES
      ('ex-squat', 'Back Squat', 5, 0),
      ('ex-bench', 'Bench Press', 8, 0);
    INSERT INTO workout_templates (id, name, scheduleType) VALUES
      ('tpl-1', 'Push Pull', 'weekly');
  `);
});

afterEach(() => ctx.close());

const squat = { exerciseId: 'ex-squat', exerciseNameSnapshot: 'Back Squat' };
const bench = { exerciseId: 'ex-bench', exerciseNameSnapshot: 'Bench Press' };

describe('startSession', () => {
  it('records the exercise list on the session itself', async () => {
    const session = await startSession({
      workoutTemplateId: 'tpl-1',
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      exercises: [squat, bench],
    });

    const exercises = await getSessionExercises(session.id);
    expect(exercises.map((e) => e.exerciseNameSnapshot)).toEqual(['Back Squat', 'Bench Press']);
    expect(exercises.map((e) => e.position)).toEqual([0, 1]);
  });

  it('supports an ad hoc session with no template, no day and no exercises', async () => {
    const session = await startSession({
      workoutTemplateId: null,
      workoutNameSnapshot: 'Quick Workout',
      dayOfWeek: null,
      exercises: [],
    });

    expect(session.workoutTemplateId).toBeNull();
    expect(session.dayOfWeek).toBeNull();
    expect(await getSessionExercises(session.id)).toHaveLength(0);

    const active = await getActiveSession();
    expect(active?.id).toBe(session.id);
  });

  it('does not leave a session behind if its exercise list fails to write', async () => {
    // position is NOT NULL; a bad row must take the whole start down with it.
    await expect(
      startSession({
        workoutTemplateId: null,
        workoutNameSnapshot: 'Quick Workout',
        dayOfWeek: null,
        exercises: [{ exerciseId: 'ex-squat', exerciseNameSnapshot: null as unknown as string }],
      })
    ).rejects.toThrow();

    expect(await getActiveSession()).toBeNull();
  });
});

describe('session exercise list', () => {
  async function startWith(exercises: typeof squat[]) {
    return startSession({
      workoutTemplateId: 'tpl-1',
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      exercises,
    });
  }

  it('appends an exercise after the existing ones', async () => {
    const session = await startWith([squat]);

    await addSessionExercise(session.id, 'ex-bench', 'Bench Press');

    const exercises = await getSessionExercises(session.id);
    expect(exercises.map((e) => e.position)).toEqual([0, 1]);
    expect(exercises[1].exerciseNameSnapshot).toBe('Bench Press');
  });

  it('appends to an empty ad hoc session', async () => {
    const session = await startWith([]);

    await addSessionExercise(session.id, 'ex-squat', 'Back Squat');

    const exercises = await getSessionExercises(session.id);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].position).toBe(0);
  });

  it('closes the gap in positions when one is removed', async () => {
    const session = await startWith([squat, bench]);
    const [first] = await getSessionExercises(session.id);

    await removeSessionExercise(first.id);

    const exercises = await getSessionExercises(session.id);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].position).toBe(0);
  });

  it('reorders to the given sequence', async () => {
    const session = await startWith([squat, bench]);
    const before = await getSessionExercises(session.id);

    await reorderSessionExercises(session.id, [before[1].id, before[0].id]);

    const after = await getSessionExercises(session.id);
    expect(after.map((e) => e.exerciseNameSnapshot)).toEqual(['Bench Press', 'Back Squat']);
    expect(after.map((e) => e.position)).toEqual([0, 1]);
  });

  it('leaves logged sets alone when an exercise is removed from the list', async () => {
    const session = await startWith([squat]);
    await logSet(session.id, 'ex-squat', 'Back Squat', 225, 5);
    const [entry] = await getSessionExercises(session.id);

    await removeSessionExercise(entry.id);

    expect(await getSetsForSession(session.id)).toHaveLength(1);
  });
});

describe('editing logged sets', () => {
  it('corrects weight and reps', async () => {
    const session = await startSession({
      workoutTemplateId: 'tpl-1',
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      exercises: [squat],
    });
    const entry = await logSet(session.id, 'ex-squat', 'Back Squat', 225, 5);

    await updateSet(entry.id, 235, 3);

    const [updated] = await getSetsForSession(session.id);
    expect(updated).toMatchObject({ weight: 235, reps: 3 });
  });

  it('leaves loggedAt alone, so history keeps its original ordering', async () => {
    const session = await startSession({
      workoutTemplateId: 'tpl-1',
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      exercises: [squat],
    });
    const entry = await logSet(session.id, 'ex-squat', 'Back Squat', 225, 5);

    await updateSet(entry.id, 235, 3);

    const [updated] = await getSetsForSession(session.id);
    expect(updated.loggedAt).toBe(entry.loggedAt);
  });

  it('deletes a set without touching the others', async () => {
    const session = await startSession({
      workoutTemplateId: 'tpl-1',
      workoutNameSnapshot: 'Push Pull',
      dayOfWeek: 'Mon',
      exercises: [squat],
    });
    const first = await logSet(session.id, 'ex-squat', 'Back Squat', 225, 5);
    await logSet(session.id, 'ex-squat', 'Back Squat', 235, 3);

    await deleteSet(first.id);

    const remaining = await getSetsForSession(session.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].weight).toBe(235);
  });
});

describe('reads that have to tolerate a missing day or template', () => {
  beforeEach(async () => {
    const adhoc = await startSession({
      workoutTemplateId: null,
      workoutNameSnapshot: 'Quick Workout',
      dayOfWeek: null,
      exercises: [squat],
    });
    await logSet(adhoc.id, 'ex-squat', 'Back Squat', 185, 8);
    await endSession(adhoc.id, 'completed');
  });

  it('returns ad hoc sets in exercise history with a null day', async () => {
    const history = await getHistoryForExercise('ex-squat');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ workoutName: 'Quick Workout', dayOfWeek: null });
  });

  it('includes ad hoc sets in the export', async () => {
    const rows = await getAllSetsForExport();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workoutName: 'Quick Workout', dayOfWeek: null });
  });
});

describe('endSession', () => {
  it('frees the single active slot', async () => {
    const session = await startSession({
      workoutTemplateId: null,
      workoutNameSnapshot: 'Quick Workout',
      dayOfWeek: null,
      exercises: [],
    });

    await endSession(session.id, 'completed');

    expect(await getActiveSession()).toBeNull();
  });

  it('keeps the sets of a canceled session', async () => {
    const session = await startSession({
      workoutTemplateId: null,
      workoutNameSnapshot: 'Quick Workout',
      dayOfWeek: null,
      exercises: [squat],
    });
    await logSet(session.id, 'ex-squat', 'Back Squat', 225, 5);

    await endSession(session.id, 'canceled');

    expect(await getSetsForSession(session.id)).toHaveLength(1);
  });
});
