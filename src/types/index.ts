export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type SessionStatus = 'active' | 'completed' | 'canceled';
export type WeightUnit = 'lb' | 'kg';

export interface Exercise {
  id: string;
  name: string;
  recommendedMaxReps: number;
  isArchived: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
}

export interface WorkoutDayTemplate {
  id: string;
  workoutTemplateId: string;
  dayOfWeek: DayOfWeek;
  orderedExerciseIds: string[];
}

export interface WorkoutSession {
  id: string;
  workoutTemplateId: string;
  workoutNameSnapshot: string;
  dayOfWeek: DayOfWeek;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
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
