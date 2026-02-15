# Weightlifting Tracker (iOS, Offline) --- Requirements

## 0) Purpose

Build a custom weightlifting tracking app for iPhone that runs entirely
offline and is developed from a Windows laptop. The app must provide a
clean, simple interface for creating repeating weekly workouts and
logging sets quickly during training. All data is stored locally
on-device. Users can review per-exercise performance over time via a
table.

This document is written for an automated coding agent. Follow it
strictly. If a requirement is unclear, implement a sensible default and
document it in `DECISIONS.md`.

------------------------------------------------------------------------

## 1) Core Principles

-   Offline-first (no network required).
-   Fast logging (minimal taps).
-   Clean, simple, iOS-native feel.
-   Reliable local storage.
-   Deterministic timer behavior.

------------------------------------------------------------------------

## 2) Platform & Development Constraints

-   Target: iPhone (iOS).
-   Development machine: Windows laptop.
-   App must function completely offline.
-   No authentication or accounts.
-   If macOS is required for final signing, document clearly in
    SETUP.md.

------------------------------------------------------------------------

## 3) Functional Requirements

### 3.1 Units

-   Support lb and kg.
-   Default unit: lb.
-   Toggle available in Settings.
-   Agent must document canonical storage strategy in DECISIONS.md.

------------------------------------------------------------------------

### 3.2 Exercises (Seed + Custom)

Seed file: `seed/exercises.json`

Schema: - name (string, unique case-insensitive) - recommendedMaxReps
(integer \> 0)

Custom exercises: - User can create. - Names must be unique. - Exercises
with history cannot be hard-deleted; must be archived.

------------------------------------------------------------------------

### 3.3 Workouts (Repeating Weekly)

-   WorkoutTemplate has:
    -   workoutName
    -   WorkoutDay entries (Mon--Sun)
-   Each WorkoutDay has:
    -   dayOfWeek
    -   ordered list of exercise IDs
-   Workouts repeat indefinitely weekly.

------------------------------------------------------------------------

### 3.4 Active Workout Session

Starting creates a WorkoutSession record.

Timers (always visible): 1) Total elapsed 2) Since last set (resets on
ANY logged set)

Grouped sets per exercise.

Logging a set: - weight (decimal) - reps (int \> 0) - Weight defaults to
most recent historical set for same exercise. - On save: - Persist
immediately - Reset since-last-set timer - Stay on same screen

Cancel session: - Mark canceled (do not delete).

Timers must use timestamps, not counters.

------------------------------------------------------------------------

### 3.5 Exercise History

Exercise Detail screen shows newest-first table: - Date/time - Workout
name - Day of week - Weight (current unit) - Reps

------------------------------------------------------------------------

### 3.6 Export (CSV)

Export all sets to CSV including: - sessionId - sessionStatus -
workoutName - dayOfWeek - sessionStartedAt - sessionEndedAt -
setLoggedAt - exerciseId - exerciseName - weight - reps

Accessible from Settings.

------------------------------------------------------------------------

## 4) Data Model

Exercise: - id - name - recommendedMaxReps - isArchived

WorkoutTemplate: - id - name

WorkoutDayTemplate: - id - workoutTemplateId - dayOfWeek -
orderedExerciseIds

WorkoutSession: - id - workoutTemplateId - workoutNameSnapshot -
dayOfWeek - startedAt - endedAt - status (active \| completed \|
canceled)

SessionSetEntry: - id - sessionId - exerciseId - exerciseNameSnapshot -
loggedAt - weight - reps

------------------------------------------------------------------------

## 5) Screens & Navigation

Navigation: Bottom tab bar 1) Workouts 2) Exercises 3) Settings

### Workouts Tab

Top: Today Shortcut - Detect current day. - Show workouts matching
today. - Start button per match. - If active session exists, show Resume
instead.

Workout List below.

Workout Detail → Weekly schedule (Mon--Sun).

Workout Day Detail: - Exercise list - Start button - Add/reorder/remove
exercises

### Active Session (Single Screen)

-   Header: Total elapsed + Since last set timers.
-   Scrollable exercise list.
-   Each exercise row:
    -   Name
    -   recommendedMaxReps
    -   Last set summary
    -   Inline Log Set button
-   End Workout / Cancel Workout buttons.

Log Set Modal: - Weight (prefilled from last historical set) - Reps -
Save → persist + reset timer + close modal.

### Exercises Tab

-   Exercise list (searchable).

-   Tap → Exercise Detail (history table).

-   -   → New Exercise.

### Settings Tab

-   Unit toggle (lb default).
-   Export Sets CSV.

------------------------------------------------------------------------

## 6) Acceptance Criteria

1.  Seed exercises load.
2.  Custom exercise persists after restart.
3.  Repeating weekly workouts work.
4.  Both timers visible and accurate.
5.  Logging any set resets since-last-set timer.
6.  Last weight autofills correctly.
7.  Exercise history table shows newest-first sets.
8.  CSV export works offline.
9.  App fully functional in airplane mode.

------------------------------------------------------------------------

## 7) Out of Scope

-   Cloud sync
-   Accounts
-   Charts/analytics
-   Wearables integration
