const { runTests } = require('./extension.test.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await runTests();
  console.log('E2E tests completed. Waiting 5 seconds before exit to allow VS Code extension startup logs to settle.');
  await sleep(5000);
}

module.exports = { run };
