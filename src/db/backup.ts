import * as SQLite from 'expo-sqlite';
import { Storage } from 'expo-sqlite/kv-store';

export const BACKUP_DB_NAME = 'workout-tracker.backup.db';

const BACKUP_AT_KEY = 'db.backupAt';

export interface BackupInfo {
  createdAt: string;
  sessionCount: number;
  setCount: number;
}

/**
 * Snapshot the live database using SQLite's online backup API. Unlike copying the
 * file, this is consistent while the connection is open — no torn WAL reads.
 *
 * Called only after a fully successful startup, so the snapshot on disk is always
 * the last known-good state. Once migrations exist, a migration that fails leaves
 * the previous launch's pre-migration snapshot intact, which is the point.
 */
export async function createBackup(source: SQLite.SQLiteDatabase): Promise<void> {
  const dest = await SQLite.openDatabaseAsync(BACKUP_DB_NAME);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: source, destDatabase: dest });
    Storage.setItemSync(BACKUP_AT_KEY, new Date().toISOString());
  } finally {
    await dest.closeAsync().catch(() => {});
  }
}

/**
 * Describes the snapshot on disk, or null if there isn't a usable one. The row
 * counts come from the backup itself rather than a stored number, so a snapshot
 * that exists but is unreadable reports as absent instead of lying.
 */
export async function getBackupInfo(): Promise<BackupInfo | null> {
  let createdAt: string | null = null;
  try {
    createdAt = Storage.getItemSync(BACKUP_AT_KEY);
  } catch {
    return null;
  }
  if (!createdAt) return null;

  const backup = await SQLite.openDatabaseAsync(BACKUP_DB_NAME);
  try {
    const sessions = await backup.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM workout_sessions'
    );
    const sets = await backup.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM session_set_entries'
    );
    return {
      createdAt,
      sessionCount: sessions?.count ?? 0,
      setCount: sets?.count ?? 0,
    };
  } catch {
    return null;
  } finally {
    await backup.closeAsync().catch(() => {});
  }
}

export function formatBackupDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}
