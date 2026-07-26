# Flexible Workouts — Implementation Plan

Date: 2026-07-26
Branch: `feature/flexible-workouts`

## Goal

Break the app's assumption that every workout belongs to a day of the week. Four capabilities:

1. **Ad hoc one-off workouts** — start a session with no template and add exercises as you go.
2. **Standalone repeated workouts** — a reusable workout with a single exercise list, startable any day.
3. **Edit existing workouts** — rename, delete, and (for standalone) edit the exercise list from the UI.
4. **Edit logged sets** — correct or delete a set, both mid-session and in history.

## Current state

```
WorkoutTemplate ──< WorkoutDayTemplate (dayOfWeek, orderedExerciseIds JSON)
WorkoutSession (workoutTemplateId, dayOfWeek) ──< SessionSetEntry
```

The blocking constraint is in `src/screens/workouts/ActiveSessionScreen.tsx:46-65`: the session's
exercise list is **derived at read time** by calling `getDaysForTemplate(session.workoutTemplateId)`
and matching `session.dayOfWeek`. A session with no template, or no day, has nothing to look up.

Secondary gaps found during review:

- `updateWorkoutTemplateName` and `deleteWorkoutTemplate` (`src/db/workouts.ts:21,26`) exist but are
  **dead code** — no screen calls them. There is no rename/delete UI.
- There is **no update or delete** for `session_set_entries` at any layer.
- There is **no schema migration mechanism**. `createTables` is `CREATE TABLE IF NOT EXISTS` only, so
  existing installs will never pick up schema changes.

## Design decisions (confirmed)

- **One unified template model.** `WorkoutTemplate` gains `scheduleType: 'weekly' | 'standalone'`.
  Weekly keeps the 7-day grid; standalone has exactly one `workout_day_templates` row with
  `dayOfWeek = NULL`. Both appear in the same "All Workouts" list.
- **Ad hoc starts empty.** A "Quick Workout" button starts a session immediately with no exercises;
  you add them from the picker inside the active session.
- **Save ad hoc as a workout.** On End Workout, offer to save the exercises used as a standalone
  template.

## The pivot: session-owned exercise lists

New table `session_exercises`, snapshotted from the template at session start and editable during the
session. This is what makes all three of the first features possible with one change, and it follows
the existing snapshot convention (`workoutNameSnapshot`, `exerciseNameSnapshot`).

```sql
CREATE TABLE session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  sessionId TEXT NOT NULL,
  exerciseId TEXT NOT NULL,
  exerciseNameSnapshot TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (sessionId) REFERENCES workout_sessions(id),
  FOREIGN KEY (exerciseId) REFERENCES exercises(id)
);
```

**Behavior change worth naming:** today, editing a template mid-session changes what the active
session shows. After this, it won't — the session holds its own copy. That is the correct behavior
and consistent with how names are already snapshotted, but it is a change.

Bonus: adding an unplanned exercise mid-session now works for *every* workout type, not just ad hoc.

## Schema changes

| Table | Change |
|---|---|
| `workout_templates` | `+ scheduleType TEXT NOT NULL DEFAULT 'weekly'` |
| `workout_day_templates` | `dayOfWeek` → nullable |
| `workout_sessions` | `workoutTemplateId` → nullable (ad hoc); `dayOfWeek` → nullable |
| `session_exercises` | new (above) |

SQLite `ALTER TABLE` cannot relax `NOT NULL`, so the two nullable changes need the
create-copy-drop-rename dance. That plus the absence of any migration runner means step 1 is
infrastructure, not feature work.

## Data safety on the Expo Go / EAS Update path

The database lives at `${documentDirectory}SQLite/workout-tracker.db`, inside Expo Go's per-project
sandbox keyed by `slug` + `extra.eas.projectId`. `eas update` ships **only the JS bundle** — it does
not touch that sandbox, so publishing this change does not by itself risk existing data.

What *would* lose data, and the rules that follow:

- **Changing `slug` or `extra.eas.projectId`** (`app.json:4,25`) → new scope key → new empty sandbox.
  Do not touch these while shipping this work.
- **Bumping `version`** (`app.json:5`) → with `runtimeVersion.policy = "appVersion"`, the existing
  Expo Go install stops receiving updates entirely. Keep it at `1.0.0` for this change.
- **A migration that throws.** `getDatabase()` (`src/db/database.ts:13-19`) has no error handling, so
  a failed migration throws on every subsequent launch — the app is unusable and the data is in a
  half-migrated state. Addressed by step 0.
- **A table rebuild that fails after `DROP`.** SQLite DDL is transactional; every rebuild must run
  inside `withTransactionAsync` so a failure rolls back rather than leaving the old table dropped.

**Resolved:** expo-sqlite does not set `PRAGMA foreign_keys` anywhere, and SQLite defaults it to off,
so foreign keys are **not enforced** at runtime. The step 1 table rebuild therefore needs no
drop/rename gymnastics around FK cascades. The corollary is that the `FOREIGN KEY` clauses in
`schema.ts` are documentation, not a constraint — nothing currently stops an orphaned row, which is
why step 8 has to null out `workoutTemplateId` explicitly on template delete rather than rely on the
declared FK.

## Work breakdown

Each numbered step is one atomic commit.

### 0. Backup and restore (prerequisite) — **implemented**, pending on-device verification

Branch `feature/db-backup-restore`. Today the only backup is CSV export (`src/utils/csv.ts`), and
**there is no import** — it is a paper record, not a restore path.

Implemented as:

- `src/db/backup.ts` — snapshot to `workout-tracker.backup.db` via expo-sqlite's
  `backupDatabaseAsync`, SQLite's native online-backup API. This replaces the file copy originally
  planned here: it is consistent while the connection is open, so there is no torn-WAL risk.
- Snapshot is taken **after** a fully successful startup, not before migrations. This gives the same
  guarantee more simply — at migration time the snapshot on disk is from the previous successful
  launch, i.e. pre-migration, with no special hook needed.
- `src/db/database.ts` — `initializeDatabase()` and `restoreFromBackup()`. Restore overwrites the
  live database and then re-runs setup, so restoring an older snapshot re-applies migrations.
- `src/screens/DatabaseErrorScreen.tsx` + `src/stores/dbStore.ts` — startup gate and recovery UI.
- `SettingsScreen` — snapshot status, **Back Up Now**, **Restore from Backup**.

Two pre-existing initialization bugs fixed along the way: a connection whose setup threw was cached
anyway (leaving a tableless database for all later callers), and concurrent callers could both run
`seedIfEmpty` and collide on the `UNIQUE` exercise name constraint.

This turns the worst case from "lost my training history" into "reopen the app."

### 1. Migration runner (`src/db/migrations.ts`)

- Version the schema with `PRAGMA user_version`.
- Ordered array of migration functions; `getDatabase()` runs pending ones inside a transaction.
- Migration `1` = the current schema, so existing installs stamp to 1 without re-running DDL.
- Migration `2` = all schema changes above, including table rebuilds with data copy.
- **Verify before writing:** confirm on a device/simulator with an existing DB that the rebuild
  preserves sessions and sets. This is the highest-risk step in the plan — it touches user data.

### 2. Types and DB layer

`src/types/index.ts`:

```ts
export type ScheduleType = 'weekly' | 'standalone';

interface WorkoutTemplate     { …; scheduleType: ScheduleType; }
interface WorkoutDayTemplate  { …; dayOfWeek: DayOfWeek | null; }
interface WorkoutSession      { …; workoutTemplateId: string | null; dayOfWeek: DayOfWeek | null; }
interface SessionExercise     { id; sessionId; exerciseId; exerciseNameSnapshot; position; }
```

`src/db/workouts.ts`:
- `createWorkoutTemplate(name, scheduleType)`; for `'standalone'`, also insert the single
  `dayOfWeek = NULL` day row so callers never special-case a missing row.
- `getStandaloneTemplates()` for the new list section.
- `getWorkoutDaysForToday` already filters `WHERE dayOfWeek = ?`, so `NULL` rows are excluded — no
  change needed, but add a regression test asserting standalone workouts never appear under "Today".

`src/db/sessions.ts`:
- `startSession(templateId | null, nameSnapshot, dayOfWeek | null, exercises[])` — inserts the
  session and its `session_exercises` rows in one transaction.
- `getSessionExercises`, `addSessionExercise`, `removeSessionExercise`, `reorderSessionExercises`.
- `updateSet(id, weight, reps)`, `deleteSet(id)`.
- Fix `getHistoryForExercise` and `getAllSetsForExport` for nullable `dayOfWeek` (they select
  `ws.dayOfWeek` directly; the CSV needs an empty column, not the string `"null"`).

### 3. Session store

- `startSession` takes the exercise list and seeds `sessionExercises` in store state.
- New `sessionExercises` slice + add/remove/reorder actions that write through to the DB.
- `updateSet` / `deleteSet` actions that also recompute `lastSetLoggedAt` — deleting the most recent
  set must roll the "Since Last Set" timer back to the set before it, not leave a stale timestamp.

### 4. ActiveSessionScreen — read from the session

- Replace `loadExercises()` (`:46-65`) with a read of `sessionExercises` from the store.
- Handle `dayOfWeek === null` in the header (`:190`) — show the date or nothing, not "null".
- Empty state becomes actionable: "No exercises yet — tap Add Exercise."
- Add **Add Exercise** button (reuses the picker modal from `WorkoutDayDetailScreen.tsx:93-109`).
- Long-press / tap a logged set → edit weight & reps, or delete. Reuses the existing log-set modal in
  edit mode rather than a second modal.

### 5. Extract a shared exercise-list editor

`WorkoutDayDetailScreen` already has add / remove / move-up / move-down (`:62-91`). Pull that into
`src/components/ExerciseListEditor.tsx` so the weekly day editor, the new standalone editor, and the
in-session list all share one implementation. Do this *after* step 4 so the third caller's needs are
known rather than guessed.

### 6. Standalone workouts UI

- `WorkoutDetailScreen`: if `scheduleType === 'standalone'`, render the `ExerciseListEditor` directly
  instead of the 7-day grid, plus a **Start Workout** button.
- New-workout modal in `WorkoutListScreen` gains a weekly/standalone toggle.
- `WorkoutListScreen` gets a section for standalone workouts that can be started any day.

### 7. Ad hoc workouts

- **Quick Workout** button on `WorkoutListScreen`, guarded by the existing single-active-session
  check (`WorkoutListScreen.tsx:87-94`).
- Starts a session with `workoutTemplateId = null`, `dayOfWeek = null`, name snapshot
  `"Quick Workout"` (editable in-session), zero exercises.
- On End Workout for a template-less session with ≥1 exercise: "Save as a workout?" → prompt for a
  name → create a standalone template from `session_exercises`.

### 8. Edit workouts

- `WorkoutDetailScreen`: header menu with **Rename** and **Delete**. Wires up the already-written
  `updateWorkoutTemplateName` / `deleteWorkoutTemplate`.
- Delete guard: `deleteWorkoutTemplate` currently deletes day rows and the template but leaves
  sessions pointing at a now-missing FK target. Since `workoutTemplateId` becomes nullable in step 1,
  null it out on delete — history survives via `workoutNameSnapshot`, which is exactly what the
  snapshot fields are for.

### 9. Edit logged sets in history

`ExerciseDetailScreen` history rows become editable (same edit/delete modal as step 4).

## Testing

The project has no test framework, but this plan rewrites the DB layer and migrates real user data —
`CLAUDE.md` guidance is to have a baseline before refactoring. **Recommendation:** add Jest +
`better-sqlite3` for the `src/db/` layer only (no React Native renderer needed), before step 1.

Minimum coverage, written test-first:

- Migration 1 → 2 preserves existing sessions, sets, and day templates.
- Migration is idempotent and no-ops on an already-migrated DB.
- `startSession` snapshots the exercise list; later template edits don't change the session.
- Standalone templates never appear in `getWorkoutDaysForToday`.
- `deleteSet` of the newest set rolls `lastSetLoggedAt` back correctly.
- CSV export handles null `dayOfWeek` and null `workoutTemplateId`.

## Risks

| Risk | Mitigation |
|---|---|
| Table-rebuild migration corrupts or loses data | Step 0 file backup; every rebuild inside `withTransactionAsync`; test-first against a copy of a populated DB |
| Failed migration bricks the app at launch | Step 0 error handling in `getDatabase()`; a fix is publishable via `eas update` since Expo Go fetches the bundle before app code runs |
| Snapshot change surprises in-flight sessions | Migration seeds `session_exercises` for any currently-active session from its template |
| Scope is large for one branch | Steps 1–4 are the foundation and ship a working app on their own; 5–9 are independently reviewable |

## Suggested sequencing

Step 0 ships **on its own, first** — backup/restore published via `eas update` and confirmed working
on the phone before any schema change exists. That way the safety net predates the risk.

Steps 1–4 then land as a second PR (foundation + no user-visible regression). Steps 5–9 follow as a
third PR of user-facing features. Split further if review gets heavy.
