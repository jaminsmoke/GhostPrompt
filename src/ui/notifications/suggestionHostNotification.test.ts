/**
 * @file Tests de notificaciones del host para sugerencias GhostPrompt.
 */
import * as vitest from 'vitest';
import { vi } from 'vitest';
import * as vscode from 'vscode';

import {
  maybeNotifySuggestionIssue,
  resetSuggestionHostNotificationThrottleForTests,
} from './suggestionNotification';

const showWarningMessageMock = vi.hoisted(() => vi.fn());

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
    }),
  },
  window: {
    showWarningMessage: showWarningMessageMock,
  },
}));

vitest.describe('maybeNotifySuggestionIssue', () => {
  vitest.beforeEach(() => {
    resetSuggestionHostNotificationThrottleForTests();
    vi.clearAllMocks();
  });

  vitest.it('no notifica razones empty no accionables en host', () => {
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'too-short' });
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'empty-response' });
    vitest.expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  vitest.it('throttle: mismo empty accionable solo una vez hasta pasar la ventana', () => {
    vi.useFakeTimers();
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    vitest.expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(91_000);
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    vitest.expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
