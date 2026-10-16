/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/tests/**',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: { statements: 95, branches: 90, functions: 85, lines: 95 },
  },
}
