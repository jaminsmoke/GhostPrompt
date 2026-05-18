/**
 * @file Punto de entrada del suite E2E (ejecuta tests y espera salida limpia).
 */
const { runTests } = require('./extension.test.js');

const E2E_EXIT_SETTLE_MS = 5000;

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms - Time in milliseconds to wait.
 * @returns {Promise<void>} Promise that resolves after the delay.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes the E2E test flow and retains logs briefly before exit.
 * @returns {Promise<void>} Resolves when the run completes.
 */
async function run() {
  await runTests();
  process.stdout.write(
    'E2E tests completed. Waiting 5 seconds before exit to allow VS Code extension startup logs to settle.\n',
  );
  await sleep(E2E_EXIT_SETTLE_MS);
}

module.exports = { run };
