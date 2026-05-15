/**
 * @file Tests de notificaciones del host para sugerencias GhostPrompt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('maybeNotifySuggestionIssue', () => {
  beforeEach(() => {
    resetSuggestionHostNotificationThrottleForTests();
    vi.clearAllMocks();
  });

  it('no notifica razones empty no accionables en host', () => {
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'too-short' });
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'empty-response' });
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('throttle: mismo empty accionable solo una vez hasta pasar la ventana', () => {
    vi.useFakeTimers();
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(91_000);
    maybeNotifySuggestionIssue({ kind: 'empty', reason: 'no-model' });
    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
