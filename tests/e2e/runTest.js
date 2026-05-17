/**
 * @file Runner de pruebas E2E con vscode/test-electron.
 */
const path = require('node:path');

const { runTests } = require('@vscode/test-electron');

/**
 * Entrypoint para ejecutar las pruebas E2E de la extensión.
 * @returns {Promise<void>} Resolves when the test runner exits.
 */
async function main() {
  try {
    const extensionDevelopmentPath = process.cwd();
    const extensionTestsPath = path.resolve(process.cwd(), 'tests/e2e/suite');
    const userDataDirectory = path.resolve(process.cwd(), '.vscode-test-profile');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-telemetry',
        '--disable-updates',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-workspace-trust',
        '--disable-crash-reporter',
        `--user-data-dir=${userDataDirectory}`
      ],
      reuseMachineInstall: true
    });
  } catch (error) {
    process.stderr.write('Failed to run E2E tests\n');
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  }
}

main();
