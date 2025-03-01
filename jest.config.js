const { defaults: tsjPreset } = require('ts-jest/presets');

module.exports = {
  // Use ts-jest for TypeScript files
  ...tsjPreset,
  testEnvironment: 'node',
  testTimeout: 15000,  // 15 seconds default timeout for all tests

  
  // Tell Jest where to find test files
  testMatch: ['**/tests/**/*.test.ts'],
  
  // Module name mapper to handle paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  verbose: true,

  // Setup files if needed
  setupFiles: ['<rootDir>/tests/unit/setup.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types/**/*.ts',
    '!src/**/*.d.ts'
  ]
  
};