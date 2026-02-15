# Decisions Log

## Weight Storage: Canonical lb

All weight values are stored in **pounds (lb)** in SQLite. Conversion to kg happens at the display layer using `1 lb = 0.45359237 kg`. This avoids dual-storage ambiguity and simplifies queries.

## Exercise IDs in Workout Days: JSON Array

`workout_day_templates.orderedExerciseIds` is stored as a JSON array string rather than a separate join table. This keeps ordering trivial and avoids extra table complexity for a client-only app.

## UUIDs for All IDs

All primary keys are UUIDs generated client-side via `expo-crypto`. No auto-increment, no server dependency.

## Snapshot Fields

`workoutNameSnapshot` and `exerciseNameSnapshot` are captured at session creation time. This ensures history is stable even if the user renames a workout or exercise later.

## Seed Exercises

Loaded on first launch when the exercises table is empty. They form the initial exercise library. Users can add custom exercises that persist alongside seed data.

## Exercise Archival vs Deletion

Exercises with logged sets cannot be hard-deleted — they are archived (hidden from picker, visible in history). Exercises with no history can be hard-deleted.
