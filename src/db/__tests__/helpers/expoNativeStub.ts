/**
 * Stands in for expo's native modules so files that import them can be loaded in
 * Node. Nothing here is called: tests either mock the module that uses these
 * (jest.mock('../database')) or exercise SQL through node:sqlite instead.
 *
 * It exists because jest's automock still has to load a module to read its
 * shape, and importing expo-sqlite outside a device throws at require time.
 */
export const openDatabaseAsync = notImplemented('openDatabaseAsync');
export const backupDatabaseAsync = notImplemented('backupDatabaseAsync');
export const deleteDatabaseAsync = notImplemented('deleteDatabaseAsync');
export const randomUUID = notImplemented('randomUUID');
export const Storage = {
  getItemSync: notImplemented('Storage.getItemSync'),
  setItemSync: notImplemented('Storage.setItemSync'),
};

function notImplemented(name: string) {
  return () => {
    throw new Error(
      `${name} is an expo native call and cannot run in tests. Mock the module that uses it.`
    );
  };
}
