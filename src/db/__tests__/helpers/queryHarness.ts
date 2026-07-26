import { runMigrations } from '../../migrations';
import { createTestDatabase, type TestDatabase } from './testDatabase';

/**
 * A migrated, empty database at the current schema version, for exercising the
 * query modules.
 *
 * Those modules reach for the real `./database`, which pulls in expo-sqlite and
 * expo-crypto — neither loads outside a device. Test files replace that module
 * with `jest.mock` and wire the mock to this database via `attach`.
 */
export async function createMigratedDatabase(): Promise<TestDatabase> {
  const ctx = createTestDatabase();
  await runMigrations(ctx.db);
  return ctx;
}

export interface MockedDatabaseModule {
  getDatabase: jest.Mock;
  generateId: jest.Mock;
}

/**
 * Points the mocked database module at `ctx` and gives generateId a counter, so
 * assertions can name the rows a function under test created.
 */
export function attach(mod: MockedDatabaseModule, ctx: TestDatabase): void {
  let n = 0;
  mod.getDatabase.mockResolvedValue(ctx.db);
  mod.generateId.mockImplementation(() => `id-${++n}`);
}
