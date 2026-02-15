# Weightlifting Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an offline-first iOS weightlifting tracker using React Native + Expo, developed on Windows.

**Architecture:** Expo managed workflow with expo-sqlite for local persistence, Zustand for state, React Navigation for bottom-tab + stack navigation. All weight stored canonically in lb; converted at display layer.

**Tech Stack:** Expo SDK 52+, TypeScript, expo-sqlite, Zustand, React Navigation 6, expo-sharing, expo-file-system, expo-crypto

---

### Task 1: Scaffold Expo Project

**Files:**
- Create: project root via `npx create-expo-app`
- Modify: `package.json`, `tsconfig.json`, `app.json`

**Step 1: Create the Expo project**

Run from `C:\ClaudeProjects\WorkoutApp`:
```bash
npx create-expo-app@latest . --template blank-typescript
```
If prompted about existing files, allow overwrite (preserve `seed/`, `docs/`, `REQUIREMENTS.md`, `DECISIONS.md`).

**Step 2: Install dependencies**

```bash
npx expo install expo-sqlite expo-crypto expo-file-system expo-sharing @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context zustand
```

**Step 3: Configure app.json**

Set in `app.json`:
```json
{
  "expo": {
    "name": "Workout Tracker",
    "slug": "workout-tracker",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash-icon.png", "resizeMode": "contain", "backgroundColor": "#ffffff" },
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.workouttracker.app" },
    "plugins": ["expo-sqlite"]
  }
}
```

**Step 4: Create src directory structure**

```bash
mkdir -p src/{components,screens/{workouts,exercises,settings},navigation,db,stores,types,utils}
```

**Step 5: Copy seed data into assets**

```bash
cp seed/exercises.json src/db/seed-exercises.json
```

**Step 6: Verify project runs**

```bash
npx expo start
```
Expected: Metro bundler starts without errors.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold Expo project with dependencies"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Define all types**

```typescript
// src/types/index.ts

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
  startedAt: string; // ISO 8601
  endedAt: string | null;
  status: SessionStatus;
}

export interface SessionSetEntry {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  loggedAt: string; // ISO 8601
  weight: number; // always in lb
  reps: number;
}

// Seed file shape
export interface SeedExercise {
  name: string;
  recommendedMaxReps: number;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts && git commit -m "feat: add TypeScript type definitions"
```

---

### Task 3: Database Schema and Initialization

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/database.ts`
- Create: `src/db/seed-exercises.json` (copied in Task 1)

**Step 1: Write the schema creation module**

```typescript
// src/db/schema.ts

import { type SQLiteDatabase } from 'expo-sqlite';

export async function createTables(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      recommendedMaxReps INTEGER NOT NULL,
      isArchived INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_day_templates (
      id TEXT PRIMARY KEY NOT NULL,
      workoutTemplateId TEXT NOT NULL,
      dayOfWeek TEXT NOT NULL,
      orderedExerciseIds TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      workoutTemplateId TEXT NOT NULL,
      workoutNameSnapshot TEXT NOT NULL,
      dayOfWeek TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
    );

    CREATE TABLE IF NOT EXISTS session_set_entries (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      exerciseId TEXT NOT NULL,
      exerciseNameSnapshot TEXT NOT NULL,
      loggedAt TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES workout_sessions(id),
      FOREIGN KEY (exerciseId) REFERENCES exercises(id)
    );
  `);
}
```

**Step 2: Write the database initialization module**

```typescript
// src/db/database.ts

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { createTables } from './schema';
import seedExercises from './seed-exercises.json';
import { type SeedExercise } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export function generateId(): string {
  return Crypto.randomUUID();
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('workout-tracker.db');
  await createTables(db);
  await seedIfEmpty(db);
  return db;
}

async function seedIfEmpty(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises'
  );
  if (result && result.count > 0) return;

  const exercises = seedExercises as SeedExercise[];
  for (const ex of exercises) {
    await database.runAsync(
      'INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES (?, ?, ?, 0)',
      [generateId(), ex.name, ex.recommendedMaxReps]
    );
  }
}
```

**Step 3: Verify database initializes**

Create a temporary test in App.tsx that calls `getDatabase()` on mount and logs success. Run `npx expo start` and check logs.

**Step 4: Commit**

```bash
git add src/db/ && git commit -m "feat: add SQLite schema, initialization, and seed loading"
```

---

### Task 4: Database Query Functions

**Files:**
- Create: `src/db/exercises.ts`
- Create: `src/db/workouts.ts`
- Create: `src/db/sessions.ts`

**Step 1: Exercise queries**

```typescript
// src/db/exercises.ts

import { getDatabase, generateId } from './database';
import { type Exercise } from '../types';

export async function getAllExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; name: string; recommendedMaxReps: number; isArchived: number;
  }>('SELECT * FROM exercises WHERE isArchived = 0 ORDER BY name COLLATE NOCASE');
  return rows.map(r => ({ ...r, isArchived: r.isArchived === 1 }));
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string; name: string; recommendedMaxReps: number; isArchived: number;
  }>('SELECT * FROM exercises WHERE id = ?', [id]);
  if (!row) return null;
  return { ...row, isArchived: row.isArchived === 1 };
}

export async function createExercise(name: string, recommendedMaxReps: number): Promise<Exercise> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO exercises (id, name, recommendedMaxReps, isArchived) VALUES (?, ?, ?, 0)',
    [id, name.trim(), recommendedMaxReps]
  );
  return { id, name: name.trim(), recommendedMaxReps, isArchived: false };
}

export async function archiveExercise(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE exercises SET isArchived = 1 WHERE id = ?', [id]);
}

export async function deleteExercise(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM exercises WHERE id = ?', [id]);
}

export async function exerciseHasHistory(id: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM session_set_entries WHERE exerciseId = ?', [id]
  );
  return (result?.count ?? 0) > 0;
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; name: string; recommendedMaxReps: number; isArchived: number;
  }>(
    'SELECT * FROM exercises WHERE isArchived = 0 AND name LIKE ? ORDER BY name COLLATE NOCASE',
    [`%${query}%`]
  );
  return rows.map(r => ({ ...r, isArchived: r.isArchived === 1 }));
}
```

**Step 2: Workout template queries**

```typescript
// src/db/workouts.ts

import { getDatabase, generateId } from './database';
import { type WorkoutTemplate, type WorkoutDayTemplate, type DayOfWeek } from '../types';

export async function getAllWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutTemplate>('SELECT * FROM workout_templates ORDER BY name');
}

export async function getWorkoutTemplateById(id: string): Promise<WorkoutTemplate | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutTemplate>('SELECT * FROM workout_templates WHERE id = ?', [id]);
}

export async function createWorkoutTemplate(name: string): Promise<WorkoutTemplate> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync('INSERT INTO workout_templates (id, name) VALUES (?, ?)', [id, name.trim()]);
  return { id, name: name.trim() };
}

export async function updateWorkoutTemplateName(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE workout_templates SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM workout_day_templates WHERE workoutTemplateId = ?', [id]);
  await db.runAsync('DELETE FROM workout_templates WHERE id = ?', [id]);
}

export async function getDaysForTemplate(workoutTemplateId: string): Promise<WorkoutDayTemplate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; workoutTemplateId: string; dayOfWeek: DayOfWeek; orderedExerciseIds: string;
  }>(
    'SELECT * FROM workout_day_templates WHERE workoutTemplateId = ? ORDER BY CASE dayOfWeek WHEN "Mon" THEN 1 WHEN "Tue" THEN 2 WHEN "Wed" THEN 3 WHEN "Thu" THEN 4 WHEN "Fri" THEN 5 WHEN "Sat" THEN 6 WHEN "Sun" THEN 7 END',
    [workoutTemplateId]
  );
  return rows.map(r => ({ ...r, orderedExerciseIds: JSON.parse(r.orderedExerciseIds) }));
}

export async function upsertWorkoutDay(
  workoutTemplateId: string,
  dayOfWeek: DayOfWeek,
  orderedExerciseIds: string[]
): Promise<WorkoutDayTemplate> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek = ?',
    [workoutTemplateId, dayOfWeek]
  );
  const idsJson = JSON.stringify(orderedExerciseIds);

  if (existing) {
    await db.runAsync(
      'UPDATE workout_day_templates SET orderedExerciseIds = ? WHERE id = ?',
      [idsJson, existing.id]
    );
    return { id: existing.id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
  } else {
    const id = generateId();
    await db.runAsync(
      'INSERT INTO workout_day_templates (id, workoutTemplateId, dayOfWeek, orderedExerciseIds) VALUES (?, ?, ?, ?)',
      [id, workoutTemplateId, dayOfWeek, idsJson]
    );
    return { id, workoutTemplateId, dayOfWeek, orderedExerciseIds };
  }
}

export async function getWorkoutDaysForToday(dayOfWeek: DayOfWeek): Promise<(WorkoutDayTemplate & { workoutName: string })[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string; workoutTemplateId: string; dayOfWeek: DayOfWeek;
    orderedExerciseIds: string; workoutName: string;
  }>(
    `SELECT wdt.*, wt.name as workoutName
     FROM workout_day_templates wdt
     JOIN workout_templates wt ON wdt.workoutTemplateId = wt.id
     WHERE wdt.dayOfWeek = ?`,
    [dayOfWeek]
  );
  return rows.map(r => ({ ...r, orderedExerciseIds: JSON.parse(r.orderedExerciseIds) }));
}
```

**Step 3: Session queries**

```typescript
// src/db/sessions.ts

import { getDatabase, generateId } from './database';
import {
  type WorkoutSession, type SessionSetEntry, type DayOfWeek, type SessionStatus
} from '../types';

export async function getActiveSession(): Promise<WorkoutSession | null> {
  const db = await getDatabase();
  return db.getFirstAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE status = 'active' LIMIT 1"
  );
}

export async function startSession(
  workoutTemplateId: string,
  workoutNameSnapshot: string,
  dayOfWeek: DayOfWeek
): Promise<WorkoutSession> {
  const db = await getDatabase();
  const id = generateId();
  const startedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO workout_sessions (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, 'active']
  );
  return { id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt: null, status: 'active' };
}

export async function endSession(id: string, status: 'completed' | 'canceled'): Promise<void> {
  const db = await getDatabase();
  const endedAt = new Date().toISOString();
  await db.runAsync(
    'UPDATE workout_sessions SET status = ?, endedAt = ? WHERE id = ?',
    [status, endedAt, id]
  );
}

export async function logSet(
  sessionId: string,
  exerciseId: string,
  exerciseNameSnapshot: string,
  weight: number,
  reps: number
): Promise<SessionSetEntry> {
  const db = await getDatabase();
  const id = generateId();
  const loggedAt = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO session_set_entries (id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps]
  );
  return { id, sessionId, exerciseId, exerciseNameSnapshot, loggedAt, weight, reps };
}

export async function getSetsForSession(sessionId: string): Promise<SessionSetEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<SessionSetEntry>(
    'SELECT * FROM session_set_entries WHERE sessionId = ? ORDER BY loggedAt ASC',
    [sessionId]
  );
}

export async function getLastSetForExercise(exerciseId: string): Promise<SessionSetEntry | null> {
  const db = await getDatabase();
  return db.getFirstAsync<SessionSetEntry>(
    'SELECT * FROM session_set_entries WHERE exerciseId = ? ORDER BY loggedAt DESC LIMIT 1',
    [exerciseId]
  );
}

export async function getHistoryForExercise(exerciseId: string): Promise<(SessionSetEntry & { workoutName: string; dayOfWeek: string })[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT sse.*, ws.workoutNameSnapshot as workoutName, ws.dayOfWeek
     FROM session_set_entries sse
     JOIN workout_sessions ws ON sse.sessionId = ws.id
     WHERE sse.exerciseId = ?
     ORDER BY sse.loggedAt DESC`,
    [exerciseId]
  );
}

export async function getAllSetsForExport(): Promise<{
  sessionId: string; sessionStatus: SessionStatus; workoutName: string;
  dayOfWeek: string; sessionStartedAt: string; sessionEndedAt: string | null;
  setLoggedAt: string; exerciseId: string; exerciseName: string;
  weight: number; reps: number;
}[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT
       ws.id as sessionId, ws.status as sessionStatus,
       ws.workoutNameSnapshot as workoutName, ws.dayOfWeek,
       ws.startedAt as sessionStartedAt, ws.endedAt as sessionEndedAt,
       sse.loggedAt as setLoggedAt, sse.exerciseId, sse.exerciseNameSnapshot as exerciseName,
       sse.weight, sse.reps
     FROM session_set_entries sse
     JOIN workout_sessions ws ON sse.sessionId = ws.id
     ORDER BY sse.loggedAt DESC`
  );
}
```

**Step 4: Commit**

```bash
git add src/db/ && git commit -m "feat: add database query functions for exercises, workouts, sessions"
```

---

### Task 5: Utility Functions

**Files:**
- Create: `src/utils/units.ts`
- Create: `src/utils/csv.ts`
- Create: `src/utils/time.ts`

**Step 1: Unit conversion**

```typescript
// src/utils/units.ts

import { type WeightUnit } from '../types';

const LB_TO_KG = 0.45359237;

export function convertWeight(weightInLb: number, targetUnit: WeightUnit): number {
  if (targetUnit === 'lb') return weightInLb;
  return Math.round(weightInLb * LB_TO_KG * 100) / 100;
}

export function convertToLb(weight: number, fromUnit: WeightUnit): number {
  if (fromUnit === 'lb') return weight;
  return Math.round((weight / LB_TO_KG) * 100) / 100;
}

export function formatWeight(weightInLb: number, unit: WeightUnit): string {
  const converted = convertWeight(weightInLb, unit);
  return `${converted} ${unit}`;
}
```

**Step 2: Time formatting**

```typescript
// src/utils/time.ts

import { type DayOfWeek } from '../types';

export function formatElapsed(startTimestamp: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startTimestamp).getTime()) / 1000);
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function getCurrentDayOfWeek(): DayOfWeek {
  const days: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

**Step 3: CSV export**

```typescript
// src/utils/csv.ts

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllSetsForExport } from '../db/sessions';
import { convertWeight } from './units';
import { type WeightUnit } from '../types';

export async function exportSetsCsv(unit: WeightUnit): Promise<void> {
  const rows = await getAllSetsForExport();

  const header = 'sessionId,sessionStatus,workoutName,dayOfWeek,sessionStartedAt,sessionEndedAt,setLoggedAt,exerciseId,exerciseName,weight,reps';
  const csvRows = rows.map(r => {
    const w = convertWeight(r.weight, unit);
    return [
      r.sessionId, r.sessionStatus, `"${r.workoutName}"`, r.dayOfWeek,
      r.sessionStartedAt, r.sessionEndedAt ?? '', r.setLoggedAt,
      r.exerciseId, `"${r.exerciseName}"`, w, r.reps
    ].join(',');
  });

  const csv = [header, ...csvRows].join('\n');
  const fileUri = FileSystem.documentDirectory + 'workout-sets-export.csv';
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Workout Sets' });
}
```

**Step 4: Commit**

```bash
git add src/utils/ && git commit -m "feat: add unit conversion, time formatting, and CSV export utilities"
```

---

### Task 6: Zustand Stores

**Files:**
- Create: `src/stores/settingsStore.ts`
- Create: `src/stores/sessionStore.ts`

**Step 1: Settings store**

```typescript
// src/stores/settingsStore.ts

import { create } from 'zustand';
import { type WeightUnit } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: We'll use expo-sqlite's Storage utility or a simple SQLite table.
// For simplicity, use a simple in-memory store that persists to SQLite on change.

interface SettingsState {
  unit: WeightUnit;
  loaded: boolean;
  setUnit: (unit: WeightUnit) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  unit: 'lb',
  loaded: false,
  setUnit: (unit) => {
    set({ unit });
    // Persist — we'll use expo-sqlite Storage
    saveUnitPreference(unit);
  },
  loadSettings: async () => {
    const unit = await loadUnitPreference();
    set({ unit, loaded: true });
  },
}));

// Simple persistence using expo-sqlite Storage API
import { Storage } from 'expo-sqlite/kv-store';

async function saveUnitPreference(unit: WeightUnit): Promise<void> {
  try {
    Storage.setItemSync('unit', unit);
  } catch {}
}

async function loadUnitPreference(): Promise<WeightUnit> {
  try {
    const val = Storage.getItemSync('unit');
    if (val === 'kg') return 'kg';
  } catch {}
  return 'lb';
}
```

**Step 2: Session store**

```typescript
// src/stores/sessionStore.ts

import { create } from 'zustand';
import { type WorkoutSession, type SessionSetEntry } from '../types';
import * as sessionsDb from '../db/sessions';

interface SessionState {
  activeSession: WorkoutSession | null;
  sets: SessionSetEntry[];
  lastSetLoggedAt: string | null; // ISO timestamp for since-last-set timer

  loadActiveSession: () => Promise<void>;
  startSession: (workoutTemplateId: string, workoutNameSnapshot: string, dayOfWeek: import('../types').DayOfWeek) => Promise<void>;
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

  startSession: async (workoutTemplateId, workoutNameSnapshot, dayOfWeek) => {
    const session = await sessionsDb.startSession(workoutTemplateId, workoutNameSnapshot, dayOfWeek);
    set({ activeSession: session, sets: [], lastSetLoggedAt: null });
  },

  logSet: async (exerciseId, exerciseNameSnapshot, weight, reps) => {
    const { activeSession } = get();
    if (!activeSession) return;
    const entry = await sessionsDb.logSet(activeSession.id, exerciseId, exerciseNameSnapshot, weight, reps);
    set(state => ({
      sets: [...state.sets, entry],
      lastSetLoggedAt: entry.loggedAt,
    }));
  },

  endSession: async (status) => {
    const { activeSession } = get();
    if (!activeSession) return;
    await sessionsDb.endSession(activeSession.id, status);
    set({ activeSession: null, sets: [], lastSetLoggedAt: null });
  },
}));
```

**Step 3: Commit**

```bash
git add src/stores/ && git commit -m "feat: add Zustand stores for settings and active session"
```

---

### Task 7: Navigation Setup

**Files:**
- Create: `src/navigation/AppNavigator.tsx`
- Create: `src/navigation/WorkoutsStack.tsx`
- Create: `src/navigation/ExercisesStack.tsx`
- Modify: `App.tsx`

**Step 1: Create the tab navigator with stack navigators**

```typescript
// src/navigation/AppNavigator.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { WorkoutsStack } from './WorkoutsStack';
import { ExercisesStack } from './ExercisesStack';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen
          name="WorkoutsTab"
          component={WorkoutsStack}
          options={{
            tabBarLabel: 'Workouts',
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="ExercisesTab"
          component={ExercisesStack}
          options={{
            tabBarLabel: 'Exercises',
            tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            headerShown: true,
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

**Step 2: Workouts stack**

```typescript
// src/navigation/WorkoutsStack.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutListScreen from '../screens/workouts/WorkoutListScreen';
import WorkoutDetailScreen from '../screens/workouts/WorkoutDetailScreen';
import WorkoutDayDetailScreen from '../screens/workouts/WorkoutDayDetailScreen';
import ActiveSessionScreen from '../screens/workouts/ActiveSessionScreen';

export type WorkoutsStackParamList = {
  WorkoutList: undefined;
  WorkoutDetail: { templateId: string };
  WorkoutDayDetail: { templateId: string; dayOfWeek: string; templateName: string };
  ActiveSession: { sessionId: string };
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export function WorkoutsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="WorkoutList" component={WorkoutListScreen} options={{ title: 'Workouts' }} />
      <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout' }} />
      <Stack.Screen name="WorkoutDayDetail" component={WorkoutDayDetailScreen} options={{ title: 'Day' }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} options={{ title: 'Session', headerBackVisible: false }} />
    </Stack.Navigator>
  );
}
```

**Step 3: Exercises stack**

```typescript
// src/navigation/ExercisesStack.tsx

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExerciseListScreen from '../screens/exercises/ExerciseListScreen';
import ExerciseDetailScreen from '../screens/exercises/ExerciseDetailScreen';

export type ExercisesStackParamList = {
  ExerciseList: undefined;
  ExerciseDetail: { exerciseId: string; exerciseName: string };
};

const Stack = createNativeStackNavigator<ExercisesStackParamList>();

export function ExercisesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ExerciseList" component={ExerciseListScreen} options={{ title: 'Exercises' }} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'History' }} />
    </Stack.Navigator>
  );
}
```

**Step 4: Update App.tsx**

```typescript
// App.tsx

import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { useSettingsStore } from './src/stores/settingsStore';
import { useSessionStore } from './src/stores/sessionStore';

export default function App() {
  const loadSettings = useSettingsStore(s => s.loadSettings);
  const loadActiveSession = useSessionStore(s => s.loadActiveSession);

  useEffect(() => {
    loadSettings();
    loadActiveSession();
  }, []);

  return <AppNavigator />;
}
```

**Step 5: Create placeholder screens** (minimal "return <Text>Screen Name</Text>" for each screen) so navigation compiles:
- `src/screens/workouts/WorkoutListScreen.tsx`
- `src/screens/workouts/WorkoutDetailScreen.tsx`
- `src/screens/workouts/WorkoutDayDetailScreen.tsx`
- `src/screens/workouts/ActiveSessionScreen.tsx`
- `src/screens/exercises/ExerciseListScreen.tsx`
- `src/screens/exercises/ExerciseDetailScreen.tsx`
- `src/screens/settings/SettingsScreen.tsx`

**Step 6: Verify navigation works**

Run `npx expo start`, confirm tabs render and stack navigation works.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add navigation structure with placeholder screens"
```

---

### Task 8: Settings Screen

**Files:**
- Implement: `src/screens/settings/SettingsScreen.tsx`

**Step 1: Build the settings screen**

- Unit toggle: segmented control or switch showing lb/kg. Uses `useSettingsStore`.
- Export CSV button: calls `exportSetsCsv(unit)` from `src/utils/csv.ts`.
- Simple, clean layout.

**Step 2: Verify toggle persists across app restart**

**Step 3: Commit**

```bash
git add src/screens/settings/ && git commit -m "feat: implement settings screen with unit toggle and CSV export"
```

---

### Task 9: Exercises Tab Screens

**Files:**
- Implement: `src/screens/exercises/ExerciseListScreen.tsx`
- Implement: `src/screens/exercises/ExerciseDetailScreen.tsx`
- Create: `src/components/NewExerciseModal.tsx`

**Step 1: Exercise list screen**

- Searchable FlatList of exercises (from `getAllExercises()` / `searchExercises()`).
- Header "+" button opens `NewExerciseModal`.
- Swipe-to-delete: check `exerciseHasHistory()` — archive if yes, delete if no.
- Tap row → navigate to `ExerciseDetail`.

**Step 2: New exercise modal**

- Text input for name, number input for recommendedMaxReps.
- Validates unique name (case-insensitive).
- Calls `createExercise()`.

**Step 3: Exercise detail screen**

- Header shows exercise name.
- FlatList of history rows from `getHistoryForExercise()`.
- Each row: formatted date/time, workout name, day of week, weight (in current unit via `formatWeight()`), reps.
- Newest first (already sorted by query).

**Step 4: Verify**

- Create a custom exercise, confirm it appears in list.
- Verify search filters correctly.

**Step 5: Commit**

```bash
git add src/screens/exercises/ src/components/ && git commit -m "feat: implement exercises tab with list, detail, and create"
```

---

### Task 10: Workout List & Detail Screens

**Files:**
- Implement: `src/screens/workouts/WorkoutListScreen.tsx`
- Implement: `src/screens/workouts/WorkoutDetailScreen.tsx`
- Create: `src/components/NewWorkoutModal.tsx`

**Step 1: Workout list screen**

- **Today section** at top:
  - Call `getCurrentDayOfWeek()` and `getWorkoutDaysForToday()`.
  - For each match: show workout name + day, with "Start" button.
  - If `useSessionStore.activeSession` exists, show "Resume" instead of "Start" (for the matching workout).
- **All Workouts** section below: FlatList from `getAllWorkoutTemplates()`.
- Header "+" button opens `NewWorkoutModal`.
- Tap row → `WorkoutDetail`.

**Step 2: New workout modal**

- Text input for workout name.
- Calls `createWorkoutTemplate()`.

**Step 3: Workout detail screen**

- Shows workout name as title.
- 7-row list (Mon–Sun).
- Each row shows day name + number of exercises configured.
- Tap row → `WorkoutDayDetail`.

**Step 4: Commit**

```bash
git add src/screens/workouts/WorkoutListScreen.tsx src/screens/workouts/WorkoutDetailScreen.tsx src/components/ && git commit -m "feat: implement workout list and detail screens"
```

---

### Task 11: Workout Day Detail Screen

**Files:**
- Implement: `src/screens/workouts/WorkoutDayDetailScreen.tsx`
- Create: `src/components/ExercisePickerModal.tsx`

**Step 1: Workout day detail screen**

- Shows day name in header (e.g., "Monday").
- Ordered list of exercises for this day (resolved from `orderedExerciseIds` via `getExerciseById()`).
- Each row: exercise name, recommendedMaxReps.
- **Add exercise**: button opens `ExercisePickerModal` (shows library, user picks one, appended to list).
- **Remove exercise**: swipe-to-remove from this day.
- **Reorder**: up/down arrow buttons on each row (or drag-to-reorder).
- **Start Workout** button: calls `startSession()` and navigates to `ActiveSession`.
- On any change, call `upsertWorkoutDay()` to persist.

**Step 2: Exercise picker modal**

- Searchable list of all non-archived exercises.
- Tap to select → added to day's exercise list.

**Step 3: Commit**

```bash
git add src/screens/workouts/WorkoutDayDetailScreen.tsx src/components/ && git commit -m "feat: implement workout day detail with exercise picker"
```

---

### Task 12: Active Session Screen

**Files:**
- Implement: `src/screens/workouts/ActiveSessionScreen.tsx`
- Create: `src/components/TimerDisplay.tsx`
- Create: `src/components/LogSetModal.tsx`

**Step 1: Timer display component**

```typescript
// src/components/TimerDisplay.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatElapsed } from '../utils/time';

interface Props {
  label: string;
  startTimestamp: string | null;
}

export default function TimerDisplay({ label, startTimestamp }: Props) {
  const [display, setDisplay] = useState('0:00');

  useEffect(() => {
    if (!startTimestamp) {
      setDisplay('0:00');
      return;
    }
    const tick = () => setDisplay(formatElapsed(startTimestamp));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTimestamp]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.time}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 8 },
  label: { fontSize: 12, color: '#666' },
  time: { fontSize: 24, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
});
```

**Step 2: Log set modal**

- Opens for a specific exercise.
- Weight input: prefilled from `getLastSetForExercise()`, converted to current display unit.
- Reps input: number.
- Save: converts weight back to lb via `convertToLb()`, calls `sessionStore.logSet()`, closes modal.

**Step 3: Active session screen**

- **Sticky header**: two `TimerDisplay` components:
  - "Total Time" with `activeSession.startedAt`
  - "Since Last Set" with `lastSetLoggedAt`
- **Body**: FlatList of exercises for the session day.
  - Resolve exercises from the day's `orderedExerciseIds`.
  - Each row: exercise name, recommendedMaxReps badge, last set summary for this session (from `sets` in store), "Log Set" button.
- **Log Set** button opens `LogSetModal` for that exercise.
- **Footer**: "End Workout" (calls `endSession('completed')`, navigates back) and "Cancel Workout" (confirmation alert, calls `endSession('canceled')`, navigates back).
- On mount, load session data if resuming.

**Step 4: Verify**

- Start a workout, verify timers tick.
- Log a set, verify since-last-set timer resets.
- End workout, verify status changes.
- Resume flow: navigate away and back, confirm Resume button works.

**Step 5: Commit**

```bash
git add src/screens/workouts/ActiveSessionScreen.tsx src/components/ && git commit -m "feat: implement active session screen with timers and set logging"
```

---

### Task 13: Integration & Polish

**Files:**
- Various touch-ups across all screens

**Step 1: Wire up Resume flow**

- On WorkoutListScreen, if active session exists, show "Resume" button that navigates to `ActiveSession` with the existing session ID.
- Ensure only one active session at a time — if user tries to start while one is active, prompt to end/cancel current first.

**Step 2: Style consistency pass**

- Ensure consistent padding, font sizes, colors across all screens.
- iOS-native feel: use system fonts, standard spacing.
- Ensure all lists have proper empty states ("No exercises yet", "No workouts yet", etc.).

**Step 3: Edge cases**

- Exercise deletion/archival: verify archived exercises still show in history but not in picker.
- Weight autofill: verify it works across sessions, not just within current session.
- CSV export: verify all columns present, weight in correct unit.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: integration polish and edge case handling"
```

---

### Task 14: Final Verification & Documentation

**Files:**
- Create: `SETUP.md`

**Step 1: Walk through all acceptance criteria**

1. Seed exercises load on first launch.
2. Custom exercise persists after restart.
3. Repeating weekly workouts work.
4. Both timers visible and accurate.
5. Logging any set resets since-last-set timer.
6. Last weight autofills correctly.
7. Exercise history table shows newest-first sets.
8. CSV export works offline.
9. App fully functional in airplane mode.

**Step 2: Write SETUP.md**

Document:
- Prerequisites (Node.js, npm, Expo CLI)
- How to run locally (`npx expo start`)
- How to build for iOS (EAS Build — requires Expo account, iOS runs require Apple Developer account)
- Note: final signing requires macOS or EAS Build cloud

**Step 3: Push to GitHub**

```bash
git remote add origin https://github.com/asfilion/workout-app.git
git push -u origin master
```

**Step 4: Commit**

```bash
git add SETUP.md && git commit -m "docs: add setup instructions"
git push
```
