/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60000,
  forceExit: true,
  setupFilesAfterEnv: ['<rootDir>/tests/jest-setup.js'],
};
