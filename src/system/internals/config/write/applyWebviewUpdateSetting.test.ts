/**
 * @file Pruebas unitarias de la actualización de configuración desde el webview.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';

const updateMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      update: (...args: unknown[]) => updateMock(...args),
    }),
  },
  'ConfigurationTarget': { 'Global': 1 },
}));

import { applyWebviewUpdateSetting } from './applyWebviewUpdateSetting';

vitest.describe('applyWebviewUpdateSetting', () => {
  vitest.beforeEach(() => {
    vi.clearAllMocks();
  });

  vitest.it('persiste agentDestination en configuración global', async () => {
    const vscode = await import('vscode');
    await applyWebviewUpdateSetting({
      type: 'updateSetting',
      key: 'agentDestination',
      value: 'vsOpenCodeX',
    });
    vitest.expect(updateMock).toHaveBeenCalledWith(
      'agentDestination',
      'vsOpenCodeX',
      vscode.ConfigurationTarget.Global,
    );
  });

  vitest.it('normaliza agentDestination a copilotChat', async () => {
    const vscode = await import('vscode');
    await applyWebviewUpdateSetting({
      type: 'updateSetting',
      key: 'agentDestination',
      value: 'copilotChat',
    });
    vitest.expect(updateMock).toHaveBeenCalledWith(
      'agentDestination',
      'copilotChat',
      vscode.ConfigurationTarget.Global,
    );
  });

  vitest.it('persiste agentDestination cursorChat', async () => {
    const vscode = await import('vscode');
    await applyWebviewUpdateSetting({
      type: 'updateSetting',
      key: 'agentDestination',
      value: 'cursorChat',
    });
    vitest.expect(updateMock).toHaveBeenCalledWith(
      'agentDestination',
      'cursorChat',
      vscode.ConfigurationTarget.Global,
    );
  });
});
