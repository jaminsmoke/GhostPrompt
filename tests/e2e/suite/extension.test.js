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
  console.log('PASS: activate extension');
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

  for (const command of commands) {
    await vscode.commands.executeCommand(command);
  }

  console.log('PASS: execute safe commands');
}

/**
 * Reads workspace configuration to ensure extension settings are accessible.
 * @returns {Promise<void>} Resolves when the configuration read succeeds.
 */
async function testReadWorkspaceConfig() {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const value = config.get('debugSuggestions');
  assert.notStrictEqual(value, undefined, 'ghostPrompt.debugSuggestions should be readable from configuration');
  console.log('PASS: read workspace configuration');
}

module.exports = { runTests };
