jest.mock('../../db/sessions');

import * as sessionsDb from '../../db/sessions';
import { useSessionStore } from '../sessionStore';
import type { SessionSetEntry, SessionExercise, WorkoutSession } from '../../types';

const mocked = sessionsDb as jest.Mocked<typeof sessionsDb>;

const session: WorkoutSession = {
  id: 'ses-1',
  workoutTemplateId: 'tpl-1',
  workoutNameSnapshot: 'Push Pull',
  dayOfWeek: 'Mon',
  startedAt: '2026-07-26T17:00:00.000Z',
  endedAt: null,
  status: 'active',
};

function set(id: string, loggedAt: string, weight = 225, reps = 5): SessionSetEntry {
  return {
    id,
    sessionId: 'ses-1',
    exerciseId: 'ex-squat',
    exerciseNameSnapshot: 'Back Squat',
    loggedAt,
    weight,
    reps,
  };
}

function exercise(id: string, position: number): SessionExercise {
  return {
    id,
    sessionId: 'ses-1',
    exerciseId: `ex-${id}`,
    exerciseNameSnapshot: `Exercise ${id}`,
    position,
  };
}

const first = set('set-1', '2026-07-26T17:10:00.000Z');
const second = set('set-2', '2026-07-26T17:20:00.000Z');

beforeEach(() => {
  jest.resetAllMocks();
  useSessionStore.setState({
    activeSession: session,
    sessionExercises: [],
    sets: [first, second],
    lastSetLoggedAt: second.loggedAt,
  });
});

describe('deleteSet', () => {
  it('rolls the rest timer back to the previous set when the newest goes', async () => {
    // "Since Last Set" reads from lastSetLoggedAt. Deleting the set it points at
    // would otherwise leave the timer counting from a set that no longer exists.
    await useSessionStore.getState().deleteSet('set-2');

    const state = useSessionStore.getState();
    expect(state.sets.map((s) => s.id)).toEqual(['set-1']);
    expect(state.lastSetLoggedAt).toBe(first.loggedAt);
  });

  it('clears the rest timer when the last remaining set goes', async () => {
    useSessionStore.setState({ sets: [first], lastSetLoggedAt: first.loggedAt });

    await useSessionStore.getState().deleteSet('set-1');

    expect(useSessionStore.getState().lastSetLoggedAt).toBeNull();
  });

  it('leaves the rest timer alone when an older set goes', async () => {
    await useSessionStore.getState().deleteSet('set-1');

    expect(useSessionStore.getState().lastSetLoggedAt).toBe(second.loggedAt);
  });

  it('persists the deletion', async () => {
    await useSessionStore.getState().deleteSet('set-1');
    expect(mocked.deleteSet).toHaveBeenCalledWith('set-1');
  });
});

describe('updateSet', () => {
  it('corrects the set in place without disturbing order', async () => {
    await useSessionStore.getState().updateSet('set-1', 235, 3);

    const state = useSessionStore.getState();
    expect(state.sets.map((s) => s.id)).toEqual(['set-1', 'set-2']);
    expect(state.sets[0]).toMatchObject({ weight: 235, reps: 3 });
  });

  it('leaves the rest timer alone, since editing a set is not logging one', async () => {
    await useSessionStore.getState().updateSet('set-2', 235, 3);

    expect(useSessionStore.getState().lastSetLoggedAt).toBe(second.loggedAt);
  });

  it('persists the correction', async () => {
    await useSessionStore.getState().updateSet('set-1', 235, 3);
    expect(mocked.updateSet).toHaveBeenCalledWith('set-1', 235, 3);
  });
});

describe('the session exercise list', () => {
  it('is seeded when a session starts', async () => {
    const seeded = [exercise('a', 0), exercise('b', 1)];
    mocked.startSession.mockResolvedValue(session);
    mocked.getSessionExercises.mockResolvedValue(seeded);

    await useSessionStore
      .getState()
      .startSession('tpl-1', 'Push Pull', 'Mon', [
        { exerciseId: 'ex-a', exerciseNameSnapshot: 'Exercise a' },
      ]);

    expect(useSessionStore.getState().sessionExercises).toEqual(seeded);
  });

  it('appends an added exercise', async () => {
    const added = exercise('b', 1);
    useSessionStore.setState({ sessionExercises: [exercise('a', 0)] });
    mocked.addSessionExercise.mockResolvedValue(added);

    await useSessionStore.getState().addExercise('ex-b', 'Exercise b');

    expect(useSessionStore.getState().sessionExercises).toEqual([exercise('a', 0), added]);
  });

  it('drops a removed exercise and closes the position gap', async () => {
    useSessionStore.setState({
      sessionExercises: [exercise('a', 0), exercise('b', 1), exercise('c', 2)],
    });

    await useSessionStore.getState().removeExercise('b');

    const remaining = useSessionStore.getState().sessionExercises;
    expect(remaining.map((e) => e.id)).toEqual(['a', 'c']);
    expect(remaining.map((e) => e.position)).toEqual([0, 1]);
    expect(mocked.removeSessionExercise).toHaveBeenCalledWith('b');
  });

  it('reorders to the given sequence and renumbers positions', async () => {
    useSessionStore.setState({ sessionExercises: [exercise('a', 0), exercise('b', 1)] });

    await useSessionStore.getState().reorderExercises(['b', 'a']);

    const reordered = useSessionStore.getState().sessionExercises;
    expect(reordered.map((e) => e.id)).toEqual(['b', 'a']);
    expect(reordered.map((e) => e.position)).toEqual([0, 1]);
    expect(mocked.reorderSessionExercises).toHaveBeenCalledWith('ses-1', ['b', 'a']);
  });

  it('is cleared when the session ends', async () => {
    useSessionStore.setState({ sessionExercises: [exercise('a', 0)] });

    await useSessionStore.getState().endSession('completed');

    const state = useSessionStore.getState();
    expect(state.activeSession).toBeNull();
    expect(state.sessionExercises).toEqual([]);
    expect(state.sets).toEqual([]);
    expect(state.lastSetLoggedAt).toBeNull();
  });
});

describe('logSet', () => {
  it('appends and moves the rest timer to the new set', async () => {
    const third = set('set-3', '2026-07-26T17:30:00.000Z');
    mocked.logSet.mockResolvedValue(third);

    await useSessionStore.getState().logSet('ex-squat', 'Back Squat', 245, 2);

    const state = useSessionStore.getState();
    expect(state.sets.map((s) => s.id)).toEqual(['set-1', 'set-2', 'set-3']);
    expect(state.lastSetLoggedAt).toBe(third.loggedAt);
  });
});
