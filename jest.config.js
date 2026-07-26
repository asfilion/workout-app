/**
 * Tests cover the SQLite layer only (src/db). These run in plain Node against
 * real SQLite via node:sqlite — no React Native renderer, no native modules.
 * Anything requiring a device (expo-sqlite's native backup API, UI) is verified
 * on hardware instead, not mocked here.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/db/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }],
  },
};
