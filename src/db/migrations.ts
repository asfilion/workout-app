import type { SQLiteDatabase } from 'expo-sqlite';

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

/**
 * The schema as originally shipped. Kept `IF NOT EXISTS` so it is a no-op on
 * installs that already have these tables but have never been stamped — those
 * devices simply move from version 0 to 1.
 */
const initialSchema: Migration = {
  version: 1,
  up: async (db) => {
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
  },
};

/**
 * Frees workouts from the weekly grid: day-independent templates, ad hoc
 * sessions with no template at all, and a session-owned exercise list.
 *
 * `dayOfWeek` and `workoutTemplateId` have to become nullable, and SQLite cannot
 * relax NOT NULL in place — hence the table rebuilds.
 *
 * Dropping workout_sessions leaves session_set_entries briefly referencing a
 * table that does not exist; runMigrations disables foreign keys around the
 * whole run for exactly this reason, and verifies integrity afterwards.
 */
const flexibleWorkouts: Migration = {
  version: 2,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE workout_templates ADD COLUMN scheduleType TEXT NOT NULL DEFAULT 'weekly';

      CREATE TABLE workout_day_templates_new (
        id TEXT PRIMARY KEY NOT NULL,
        workoutTemplateId TEXT NOT NULL,
        dayOfWeek TEXT,
        orderedExerciseIds TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
      );
      INSERT INTO workout_day_templates_new (id, workoutTemplateId, dayOfWeek, orderedExerciseIds)
        SELECT id, workoutTemplateId, dayOfWeek, orderedExerciseIds FROM workout_day_templates;
      DROP TABLE workout_day_templates;
      ALTER TABLE workout_day_templates_new RENAME TO workout_day_templates;

      CREATE TABLE workout_sessions_new (
        id TEXT PRIMARY KEY NOT NULL,
        workoutTemplateId TEXT,
        workoutNameSnapshot TEXT NOT NULL,
        dayOfWeek TEXT,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        FOREIGN KEY (workoutTemplateId) REFERENCES workout_templates(id)
      );
      INSERT INTO workout_sessions_new (id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt, status)
        SELECT id, workoutTemplateId, workoutNameSnapshot, dayOfWeek, startedAt, endedAt, status FROM workout_sessions;
      DROP TABLE workout_sessions;
      ALTER TABLE workout_sessions_new RENAME TO workout_sessions;

      CREATE TABLE IF NOT EXISTS session_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        sessionId TEXT NOT NULL,
        exerciseId TEXT NOT NULL,
        exerciseNameSnapshot TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES workout_sessions(id),
        FOREIGN KEY (exerciseId) REFERENCES exercises(id)
      );
    `);

    await seedActiveSessionExercises(db);
  },
};

/**
 * Sessions now own their exercise list instead of looking it up through the
 * template. A session that is mid-flight when the app updates would otherwise
 * come up empty, so copy its template day across.
 *
 * Finished sessions are left alone: their record is the sets they logged.
 */
async function seedActiveSessionExercises(db: SQLiteDatabase): Promise<void> {
  const active = await db.getAllAsync<{
    id: string;
    workoutTemplateId: string | null;
    dayOfWeek: string | null;
  }>("SELECT id, workoutTemplateId, dayOfWeek FROM workout_sessions WHERE status = 'active'");

  for (const session of active) {
    if (!session.workoutTemplateId || !session.dayOfWeek) continue;

    const day = await db.getFirstAsync<{ orderedExerciseIds: string }>(
      'SELECT orderedExerciseIds FROM workout_day_templates WHERE workoutTemplateId = ? AND dayOfWeek = ?',
      [session.workoutTemplateId, session.dayOfWeek]
    );
    if (!day) continue;

    let exerciseIds: string[];
    try {
      exerciseIds = JSON.parse(day.orderedExerciseIds);
    } catch {
      continue;
    }

    let position = 0;
    for (const exerciseId of exerciseIds) {
      const exercise = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM exercises WHERE id = ?',
        [exerciseId]
      );
      if (!exercise) continue;
      // Derived rather than random: migrations must not depend on expo-crypto,
      // and this is unique by construction.
      await db.runAsync(
        'INSERT INTO session_exercises (id, sessionId, exerciseId, exerciseNameSnapshot, position) VALUES (?, ?, ?, ?, ?)',
        [`${session.id}-se-${position}`, session.id, exerciseId, exercise.name, position]
      );
      position++;
    }
  }
}

export const MIGRATIONS: Migration[] = [initialSchema, flexibleWorkouts];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

interface ForeignKeyViolation {
  table: string;
  rowid: number;
  parent: string;
}

/**
 * Applies pending migrations in order. Each runs in its own transaction together
 * with its version stamp, so a failure rolls back that migration entirely and
 * leaves the recorded version on the last one that succeeded — SQLite keeps
 * user_version in the database header, which is transactional.
 *
 * Foreign keys are disabled for the duration, following SQLite's documented
 * procedure for table rebuilds. This is not optional and it is not cosmetic:
 * DROP TABLE under enforcement runs an implicit DELETE that increments the
 * deferred-constraint counter for every child row, and the subsequent RENAME
 * never decrements it. COMMIT then fails even though the data is perfectly
 * consistent and `foreign_key_check` reports nothing. `defer_foreign_keys` does
 * not help, and `foreign_keys` itself is a no-op inside a transaction, so the
 * toggle has to live out here.
 *
 * Integrity is still enforced — `foreign_key_check` runs inside each migration's
 * transaction, so a migration that genuinely orphans a row rolls back rather
 * than committing quietly.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  migrations: Migration[] = MIGRATIONS
): Promise<void> {
  const current = await getSchemaVersion(db);
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;

  const fkRow = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  const foreignKeysWereOn = fkRow?.foreign_keys === 1;
  if (foreignKeysWereOn) await db.execAsync('PRAGMA foreign_keys = OFF');

  try {
    for (const migration of pending) {
      await db.withTransactionAsync(async () => {
        await migration.up(db);

        const violations = await db.getAllAsync<ForeignKeyViolation>('PRAGMA foreign_key_check');
        if (violations.length > 0) {
          const summary = violations
            .slice(0, 5)
            .map((v) => `${v.table} -> ${v.parent}`)
            .join(', ');
          throw new Error(
            `Migration ${migration.version} left ${violations.length} orphaned row(s): ${summary}`
          );
        }

        await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      });
    }
  } finally {
    if (foreignKeysWereOn) await db.execAsync('PRAGMA foreign_keys = ON');
  }
}
