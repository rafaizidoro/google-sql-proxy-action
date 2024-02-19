import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8',
  // A list of paths to directories that Jest should use to search for test files
  roots: ['<rootDir>/tests'],
  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  // The test environment that will be used for testing
  testEnvironment: 'node',
  // An array of file extensions your modules use
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};

export default config;
