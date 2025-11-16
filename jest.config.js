module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/backend'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        rootDir: './backend',
        baseUrl: './backend',
        paths: {
          '@/*': ['./backend/src/*'],
          '@sos/shared': ['./shared/src'],
        },
      },
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'backend/src/**/*.ts',
    '!backend/src/**/*.d.ts',
    '!backend/src/**/__tests__/**',
    '!backend/src/index.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/src/$1',
    '^@sos/shared$': '<rootDir>/shared/src',
  },
  moduleDirectories: ['node_modules', '<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/backend/src/__tests__/setup.ts'],
};

