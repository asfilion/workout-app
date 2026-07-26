/**
 * Tests cover the SQLite layer only (src/db). These run in plain Node against
 * real SQLite via node:sqlite — no React Native renderer, no native modules.
 * Anything requiring a device (expo-sqlite's native backup API, UI) is verified
 * on hardware instead, not mocked here.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.ts'],
  // expo's native modules throw at require time off-device, and jest's automock
  // has to load a module to read its shape. Stub them at resolution.
  moduleNameMapper: {
    '^expo-sqlite$': '<rootDir>/src/db/__tests__/helpers/expoNativeStub.ts',
    '^expo-sqlite/kv-store$': '<rootDir>/src/db/__tests__/helpers/expoNativeStub.ts',
    '^expo-crypto$': '<rootDir>/src/db/__tests__/helpers/expoNativeStub.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true } }],
  },
};
