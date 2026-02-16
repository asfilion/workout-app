# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install              # Install dependencies
npx expo start           # Start Metro dev server (scan QR with Expo Go)
npx tsc --noEmit         # Type-check (no linter or test framework configured)
```

Standalone iOS builds use EAS Build: `eas build --platform ios --profile production`

## Architecture

Offline-first iOS weightlifting tracker. React Native + Expo (SDK 54), TypeScript, expo-sqlite, Zustand, React Navigation.

**Data flow:** SQLite → query modules (`src/db/*.ts`) → Zustand stores / direct screen calls → React components

- **DB layer** (`src/db/`): Stateless async query functions. `database.ts` holds a singleton SQLite connection (`getDatabase()`) and seeds 22 exercises on first launch. `generateId()` creates UUIDs via expo-crypto.
- **Stores** (`src/stores/`): `sessionStore` manages active workout state (session, sets, timer timestamps). `settingsStore` manages unit preference via `expo-sqlite/kv-store`. Screens use stores for session lifecycle but call DB query functions directly for reads.
- **Screens** reload data on navigation focus via `useFocusEffect(useCallback(...))`.

## Key Conventions

- **Weight is stored in lb.** Always. Conversion to/from kg happens only at the display layer using `convertWeight()` / `convertToLb()` in `src/utils/units.ts`.
- **Snapshot fields** (`workoutNameSnapshot`, `exerciseNameSnapshot`) are captured at session creation and never updated — they preserve history even if names change later.
- **`orderedExerciseIds`** is stored as a JSON array string in SQLite, parsed on read in query functions.
- **Timers use ISO timestamps**, not incrementing counters. `formatElapsed(isoString)` computes elapsed time from `Date.now()`.
- **Only one active session at a time.** Enforced by querying `WHERE status = 'active' LIMIT 1`.
- **Canceled sessions preserve sets** — status changes to `'canceled'`, nothing is deleted.
- **Exercises with history are archived, not deleted.** Check `exerciseHasHistory()` before deciding.
- **`expo-file-system/legacy`** — use the legacy subpath, not `expo-file-system` directly (v2 moved the classic API).

## Navigation

Three bottom tabs: Workouts, Exercises, Settings. Workouts and Exercises each have a native stack navigator. Param types are exported from `src/navigation/WorkoutsStack.tsx` and `ExercisesStack.tsx`.

## Types

All shared types live in `src/types/index.ts`: `DayOfWeek`, `SessionStatus`, `WeightUnit`, and interfaces for all DB entities.
