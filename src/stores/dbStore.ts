import { create } from 'zustand';
import { initializeDatabase, restoreFromBackup, getDatabase } from '../db/database';
import { createBackup, getBackupInfo, type BackupInfo } from '../db/backup';

type DbStatus = 'initializing' | 'ready' | 'error';

interface DbState {
  status: DbStatus;
  error: string | null;
  backup: BackupInfo | null;
  initialize: () => Promise<void>;
  refreshBackupInfo: () => Promise<void>;
  backupNow: () => Promise<void>;
  restore: () => Promise<void>;
}

export const useDbStore = create<DbState>((set, get) => ({
  status: 'initializing',
  error: null,
  backup: null,
  initialize: async () => {
    set({ status: 'initializing', error: null });
    try {
      await initializeDatabase();
      set({ status: 'ready', error: null });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
    await get().refreshBackupInfo();
  },
  refreshBackupInfo: async () => {
    try {
      set({ backup: await getBackupInfo() });
    } catch {
      set({ backup: null });
    }
  },
  backupNow: async () => {
    await createBackup(await getDatabase());
    await get().refreshBackupInfo();
  },
  restore: async () => {
    await restoreFromBackup();
    set({ status: 'ready', error: null });
    await get().refreshBackupInfo();
  },
}));
