/**
 * @file Pruebas E2E de activación y comandos seguros de la extensión.
 */
const assert = require('node:assert');

const vscode = require('vscode');

/**
 * Runs the end-to-end extension smoke tests.
 * @returns {Promise<void>} Resolves when all individual tests complete.
 */
async function runTests() {
  await testActivateExtension();
  await testExecuteSafeCommands();
  await testReadWorkspaceConfig();
}

/**
 * Verifies the extension can be found and activated by VS Code.
 * @returns {Promise<void>} Resolves if activation succeeds.
 */
async function testActivateExtension() {
  const extension = vscode.extensions.getExtension('jaminsmoke.ghost-prompt');
  assert.ok(extension, 'Extension should be found');
  await extension.activate();
  assert.strictEqual(extension.isActive, true);
  process.stdout.write('PASS: activate extension\n');
}

/**
 * Executes a subset of safe commands to verify command registration.
 * @returns {Promise<void>} Resolves when all commands run without error.
 */
async function testExecuteSafeCommands() {
  const commands = [
    'ghostPrompt.openSuggestionPolicySettings',
    'ghostPrompt.toggleSuggestionDebug'
  ];

  const runCommandAt = async (index) => {
    if (index >= commands.length) {
      return;
    }
    await vscode.commands.executeCommand(commands[index]);
    await runCommandAt(index + 1);
  };
  await runCommandAt(0);

  process.stdout.write('PASS: execute safe commands\n');
}

/**
 * Reads workspace configuration to ensure extension settings are accessible.
 * @returns {Promise<void>} Resolves when the configuration read succeeds.
 */
async function testReadWorkspaceConfig() {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const value = config.get('debugSuggestions');
  assert.notStrictEqual(value, 'ghostPrompt.debugSuggestions should be readable from configuration');
  process.stdout.write('PASS: read workspace configuration\n');
}

module.exports = { runTests };
