module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'repository_before/**/*.js',
        'repository_after/**/*.js',
        '!**/node_modules/**'
    ],
    testTimeout: 10000,
    verbose: true
};
