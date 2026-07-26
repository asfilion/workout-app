export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type SessionStatus = 'active' | 'completed' | 'canceled';
export type WeightUnit = 'lb' | 'kg';

/**
 * 'weekly' workouts hang off the day grid. 'standalone' ones have a single
 * exercise list and can be started any day.
 */
export type ScheduleType = 'weekly' | 'standalone';

export interface Exercise {
  id: string;
  name: string;
  recommendedMaxReps: number;
  isArchived: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  scheduleType: ScheduleType;
}

export interface WorkoutDayTemplate {
  id: string;
  workoutTemplateId: string;
  /** null on a standalone workout's single day-independent list. */
  dayOfWeek: DayOfWeek | null;
  orderedExerciseIds: string[];
}

export interface WorkoutSession {
  id: string;
  /** null for an ad hoc session, or once its template has been deleted. */
  workoutTemplateId: string | null;
  workoutNameSnapshot: string;
  /** null for ad hoc and standalone sessions, which belong to no weekday. */
  dayOfWeek: DayOfWeek | null;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
}

/**
 * A session's own copy of its exercise list, snapshotted at start. Editing the
 * template afterwards does not reach back into a session already underway.
 */
export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  position: number;
}

export interface SessionSetEntry {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  loggedAt: string;
  weight: number;
  reps: number;
}

export interface SeedExercise {
  name: string;
  recommendedMaxReps: number;
}
