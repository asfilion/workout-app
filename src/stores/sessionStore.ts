import { create } from 'zustand';
import {
  type WorkoutSession,
  type SessionSetEntry,
  type SessionExercise,
  type DayOfWeek,
} from '../types';
import * as sessionsDb from '../db/sessions';
import { type SessionExerciseInput } from '../db/sessions';

interface SessionState {
  activeSession: WorkoutSession | null;
  /** The session's own exercise list, not the template's. */
  sessionExercises: SessionExercise[];
  sets: SessionSetEntry[];
  lastSetLoggedAt: string | null;
  loadActiveSession: () => Promise<void>;
  startSession: (
    workoutTemplateId: string | null,
    workoutNameSnapshot: string,
    dayOfWeek: DayOfWeek | null,
    // Required: a caller that forgets this starts an empty workout, and the
    // screen has no template to fall back on any more.
    exercises: SessionExerciseInput[]
  ) => Promise<void>;
  addExercise: (exerciseId: string, exerciseNameSnapshot: string) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
  reorderExercises: (orderedIds: string[]) => Promise<void>;
  logSet: (
    exerciseId: string,
    exerciseNameSnapshot: string,
    weight: number,
    reps: number
  ) => Promise<void>;
  updateSet: (id: string, weight: number, reps: number) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  endSession: (status: 'completed' | 'canceled') => Promise<void>;
}

/** Sets are held oldest-first, so the rest timer runs from the last of them. */
function restTimerFrom(sets: SessionSetEntry[]): string | null {
  return sets.length > 0 ? sets[sets.length - 1].loggedAt : null;
}

function renumber(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((e, position) => ({ ...e, position }));
}

const emptySession = {
  activeSession: null,
  sessionExercises: [],
  sets: [],
  lastSetLoggedAt: null,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  sessionExercises: [],
  sets: [],
  lastSetLoggedAt: null,

  loadActiveSession: async () => {
    const session = await sessionsDb.getActiveSession();
    if (!session) {
      set(emptySession);
      return;
    }
    const [sets, sessionExercises] = await Promise.all([
      sessionsDb.getSetsForSession(session.id),
      sessionsDb.getSessionExercises(session.id),
    ]);
    set({
      activeSession: session,
      sessionExercises,
      sets,
      lastSetLoggedAt: restTimerFrom(sets),
    });
  },

  startSession: async (workoutTemplateId, workoutNameSnapshot, dayOfWeek, exercises) => {
    const session = await sessionsDb.startSession({
      workoutTemplateId,
      workoutNameSnapshot,
      dayOfWeek,
      exercises,
    });
    // Read back rather than reconstruct: the rows carry their generated ids,
    // which the list needs for remove and reorder.
    const sessionExercises = await sessionsDb.getSessionExercises(session.id);
    set({ activeSession: session, sessionExercises, sets: [], lastSetLoggedAt: null });
  },

  addExercise: async (exerciseId, exerciseNameSnapshot) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const added = await sessionsDb.addSessionExercise(
      activeSession.id,
      exerciseId,
      exerciseNameSnapshot
    );
    set((state) => ({ sessionExercises: [...state.sessionExercises, added] }));
  },

  removeExercise: async (id) => {
    await sessionsDb.removeSessionExercise(id);
    set((state) => ({
      sessionExercises: renumber(state.sessionExercises.filter((e) => e.id !== id)),
    }));
  },

  reorderExercises: async (orderedIds) => {
    const { activeSession, sessionExercises } = get();
    if (!activeSession) return;
    await sessionsDb.reorderSessionExercises(activeSession.id, orderedIds);
    const byId = new Map(sessionExercises.map((e) => [e.id, e]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((e): e is SessionExercise => e !== undefined);
    set({ sessionExercises: renumber(reordered) });
  },

  logSet: async (exerciseId, exerciseNameSnapshot, weight, reps) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const entry = await sessionsDb.logSet(
      activeSession.id,
      exerciseId,
      exerciseNameSnapshot,
      weight,
      reps
    );
    set((state) => ({ sets: [...state.sets, entry], lastSetLoggedAt: entry.loggedAt }));
  },

  updateSet: async (id, weight, reps) => {
    await sessionsDb.updateSet(id, weight, reps);
    // loggedAt is untouched, so ordering and the rest timer both stand.
    set((state) => ({
      sets: state.sets.map((s) => (s.id === id ? { ...s, weight, reps } : s)),
    }));
  },

  deleteSet: async (id) => {
    await sessionsDb.deleteSet(id);
    set((state) => {
      const sets = state.sets.filter((s) => s.id !== id);
      // Deleting the newest set has to walk the rest timer back, or it keeps
      // counting from a set that is no longer there.
      return { sets, lastSetLoggedAt: restTimerFrom(sets) };
    });
  },

  endSession: async (status) => {
    const { activeSession } = get();
    if (!activeSession) return;
    await sessionsDb.endSession(activeSession.id, status);
    set(emptySession);
  },
}));
