# Weightlifting Tracker — Design Document

## Tech Stack

- **React Native + Expo** (managed workflow, SDK 52+)
- **TypeScript**
- **expo-sqlite** for local storage
- **Zustand** for state management
- **React Navigation** (bottom tabs + stack navigators)
- **expo-sharing** + **expo-file-system** for CSV export
- Development on Windows; iOS builds via EAS Build

## Project Structure

```
src/
  components/       # Reusable UI (TimerDisplay, SetLogModal, etc.)
  screens/
    workouts/       # WorkoutList, WorkoutDetail, WorkoutDayDetail, ActiveSession
    exercises/      # ExerciseList, ExerciseDetail, NewExercise
    settings/       # SettingsScreen
  navigation/       # Tab and stack navigator config
  db/               # SQLite schema, migrations, queries
  stores/           # Zustand stores (session, settings, timer)
  types/            # TypeScript type definitions
  utils/            # Unit conversion, CSV export, helpers
seed/
  exercises.json
```

## Data Model (SQLite)

All weight values stored in **lb** canonically. Converted to/from kg at the display layer (`1 lb = 0.45359237 kg`).

### Tables

**exercises**
- `id` TEXT PRIMARY KEY (UUID)
- `name` TEXT UNIQUE (case-insensitive)
- `recommendedMaxReps` INTEGER
- `isArchived` INTEGER (0/1)

**workout_templates**
- `id` TEXT PRIMARY KEY (UUID)
- `name` TEXT

**workout_day_templates**
- `id` TEXT PRIMARY KEY (UUID)
- `workoutTemplateId` TEXT (FK)
- `dayOfWeek` TEXT (Mon/Tue/Wed/Thu/Fri/Sat/Sun)
- `orderedExerciseIds` TEXT (JSON array of exercise IDs)

**workout_sessions**
- `id` TEXT PRIMARY KEY (UUID)
- `workoutTemplateId` TEXT (FK)
- `workoutNameSnapshot` TEXT
- `dayOfWeek` TEXT
- `startedAt` TEXT (ISO 8601)
- `endedAt` TEXT (ISO 8601, nullable)
- `status` TEXT (active/completed/canceled)

**session_set_entries**
- `id` TEXT PRIMARY KEY (UUID)
- `sessionId` TEXT (FK)
- `exerciseId` TEXT (FK)
- `exerciseNameSnapshot` TEXT
- `loggedAt` TEXT (ISO 8601)
- `weight` REAL (in lb)
- `reps` INTEGER

### Key Decisions

- UUIDs generated client-side (expo-crypto).
- `orderedExerciseIds` stored as JSON array string to avoid a join table.
- Snapshot fields (`workoutNameSnapshot`, `exerciseNameSnapshot`) captured at session creation so history is stable if names change.
- Seed exercises loaded on first launch when exercises table is empty. They form the initial exercise library; users add custom exercises over time.

## Exercise Library

- Exercises are a **library** — seeded on first launch from `seed/exercises.json`, grown by the user.
- Workouts reference exercises from this library.
- Names must be unique (case-insensitive). Validated on create.
- Exercises referenced in `session_set_entries` cannot be deleted — only archived. Archived exercises are hidden from the library picker but remain in history.
- Exercises with zero history can be hard-deleted.

## Screens & Navigation

### Bottom Tab Bar: Workouts | Exercises | Settings

### Workouts Tab (Stack)

1. **WorkoutList** — "Today" shortcut at top (current day detection, matching workout days with Start/Resume). Below: list of all workout templates. "+" to create.
2. **WorkoutDetail** — Template name + 7-day grid (Mon–Sun). Tap a day to configure.
3. **WorkoutDayDetail** — Ordered exercise list from library. Add/reorder/remove exercises. Start button.
4. **ActiveSession** — Full-screen:
   - Sticky header: two timers (total elapsed, since last set)
   - Scrollable exercise list: name, recommendedMaxReps badge, last-set summary, "Log Set" button
   - Log Set Modal: weight (prefilled from most recent historical set), reps, Save
   - Footer: End Workout / Cancel Workout

### Exercises Tab (Stack)

1. **ExerciseList** — Searchable. "+" for custom exercise. Archive/delete via swipe.
2. **ExerciseDetail** — History table (newest first): date/time, workout name, day, weight (current unit), reps.

### Settings Tab (Single Screen)

- Unit toggle (lb/kg, default lb)
- Export CSV button (share sheet)

## Key Behaviors

### Timers
- Both use stored timestamps (`startedAt`, `lastSetLoggedAt`), not incrementing counters.
- `setInterval` (1s) triggers re-render computing `now - timestamp`.
- App background/foreground: timers stay accurate (timestamp-based).
- `lastSetLoggedAt` resets on ANY set logged across any exercise.

### Active Session
- Only one active session at a time.
- "Resume" shows on WorkoutList if an active session exists.
- Cancel: `status = 'canceled'`, session + sets preserved.
- End: `status = 'completed'`, `endedAt` recorded.

### Weight Autofill
- Log Set modal queries most recent `session_set_entries` row for that `exerciseId` (all sessions).
- Prefills weight converted to current display unit.
- Empty if no history.

### CSV Export
- Columns: sessionId, sessionStatus, workoutName, dayOfWeek, sessionStartedAt, sessionEndedAt, setLoggedAt, exerciseId, exerciseName, weight, reps.
- Weight in currently selected unit.
- `expo-file-system` writes temp file, `expo-sharing` opens share sheet.

## Zustand Stores

- **`useSettingsStore`** — unit preference (lb/kg), persisted.
- **`useSessionStore`** — active session state, timer timestamps, current exercise list.
