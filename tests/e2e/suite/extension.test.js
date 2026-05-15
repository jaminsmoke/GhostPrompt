const assert = require('assert');
const vscode = require('vscode');

async function runTests() {
  await testActivateExtension();
  await testExecuteSafeCommands();
  await testReadWorkspaceConfig();
}

async function testActivateExtension() {
  const extension = vscode.extensions.getExtension('jaminsmoke.ghost-prompt');
  assert.ok(extension, 'Extension should be found');
  await extension.activate();
  assert.strictEqual(extension.isActive, true);
  console.log('PASS: activate extension');
}

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

async function testReadWorkspaceConfig() {
  const config = vscode.workspace.getConfiguration('ghostPrompt');
  const value = config.get('debugSuggestions');
  assert.notStrictEqual(value, undefined, 'ghostPrompt.debugSuggestions should be readable from configuration');
  console.log('PASS: read workspace configuration');
}

module.exports = { runTests };
