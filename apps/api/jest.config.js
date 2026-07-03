/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^marked$': '<rootDir>/src/__tests__/utils/__mocks__/marked.ts',
    '^isomorphic-dompurify$': '<rootDir>/src/__tests__/utils/__mocks__/isomorphic-dompurify.ts',
    '^jwks-rsa$': '<rootDir>/src/__tests__/utils/__mocks__/jwks-rsa.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: {
          ignoreCodes: [6133, 6196, 2323, 2484],
        },
      },
    ],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(marked|jose|jwks-rsa)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/server.ts',
    '!src/**/*.types.ts',
    '!src/scripts/**',
    '!src/docs/**',
    '!src/middleware/security.ts',
    '!src/middleware/performance.ts',
    '!src/database/optimizations.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: '.', outputName: 'junit.xml' }],
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/utils/setup-integration.ts',
    '<rootDir>/src/__tests__/setup.ts',
  ],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
