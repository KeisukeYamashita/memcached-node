module.exports = {
    roots: ['<rootDir>/test'],
    transform: {
      '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    collectCoverageFrom: [
      "**/*.{js,jsx,ts}",
      "!**/node_modules/**",
      "!**/vendor/**"
    ],
    collectCoverage: true,
    coverageDirectory: "./coverage/"
}
