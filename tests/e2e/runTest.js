/**
 * @file Runner de pruebas E2E con vscode/test-electron.
 */
const path = require('path');

const { runTests } = require('@vscode/test-electron');

/**
 * Entrypoint para ejecutar las pruebas E2E de la extensión.
 * @returns {Promise<void>} Resolves when the test runner exits.
 */
async function main() {
  try {
    const extensionDevelopmentPath = process.cwd();
    const extensionTestsPath = path.resolve(process.cwd(), 'tests/e2e/suite');
    const userDataDir = path.resolve(process.cwd(), '.vscode-test-profile');

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
        `--user-data-dir=${userDataDir}`
      ],
      reuseMachineInstall: true
    });
  } catch (err) {
    console.error('Failed to run E2E tests');
    console.error(err);
    process.exit(1);
  }
}

main();
