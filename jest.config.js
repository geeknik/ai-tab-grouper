export default {
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
  moduleFileExtensions: ['js'],
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^./src/(.*)$': '<rootDir>/src/$1',
  }
}; 