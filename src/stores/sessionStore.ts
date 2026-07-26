import { create } from 'zustand';
import { type WorkoutSession, type SessionSetEntry, type DayOfWeek } from '../types';
import * as sessionsDb from '../db/sessions';
import { type SessionExerciseInput } from '../db/sessions';

interface SessionState {
  activeSession: WorkoutSession | null;
  sets: SessionSetEntry[];
  lastSetLoggedAt: string | null;
  loadActiveSession: () => Promise<void>;
  startSession: (
    workoutTemplateId: string | null,
    workoutNameSnapshot: string,
    dayOfWeek: DayOfWeek | null,
    exercises?: SessionExerciseInput[]
  ) => Promise<void>;
  logSet: (exerciseId: string, exerciseNameSnapshot: string, weight: number, reps: number) => Promise<void>;
  endSession: (status: 'completed' | 'canceled') => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  sets: [],
  lastSetLoggedAt: null,
  loadActiveSession: async () => {
    const session = await sessionsDb.getActiveSession();
    if (session) {
      const sets = await sessionsDb.getSetsForSession(session.id);
      const lastSet = sets.length > 0 ? sets[sets.length - 1].loggedAt : null;
      set({ activeSession: session, sets, lastSetLoggedAt: lastSet });
    } else {
      set({ activeSession: null, sets: [], lastSetLoggedAt: null });
    }
  },
  // `exercises` is optional only until step 4 wires the screens up to pass it;
  // ActiveSessionScreen still resolves its list through the template.
  startSession: async (workoutTemplateId, workoutNameSnapshot, dayOfWeek, exercises = []) => {
    const session = await sessionsDb.startSession({
      workoutTemplateId,
      workoutNameSnapshot,
      dayOfWeek,
      exercises,
    });
    set({ activeSession: session, sets: [], lastSetLoggedAt: null });
  },
  logSet: async (exerciseId, exerciseNameSnapshot, weight, reps) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const entry = await sessionsDb.logSet(activeSession.id, exerciseId, exerciseNameSnapshot, weight, reps);
    set(state => ({ sets: [...state.sets, entry], lastSetLoggedAt: entry.loggedAt }));
  },
  endSession: async (status) => {
    const { activeSession } = get();
    if (!activeSession) return;
    await sessionsDb.endSession(activeSession.id, status);
    set({ activeSession: null, sets: [], lastSetLoggedAt: null });
  },
}));
