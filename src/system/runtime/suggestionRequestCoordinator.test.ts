/**
 * @file Tests del coordinador de peticiones de suggestion.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  ['CancellationTokenSource']: class {
    token = { isCancellationRequested: false };
    cancel(): void {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
}));

import { SuggestionRequestCoordinator } from './suggestionRequestCoordinator';

describe('SuggestionRequestCoordinator', () => {
  let coordinator: SuggestionRequestCoordinator;

  beforeEach(() => {
    coordinator = new SuggestionRequestCoordinator();
  });

  it('prepareRequest fija capture activo y cancela token anterior', () => {
    const a = coordinator.prepareRequest(1);
    expect(coordinator.getActiveCaptureId()).toBe(1);
    expect(coordinator.isActiveCapture(1)).toBe(true);

    const b = coordinator.prepareRequest(2);
    expect(coordinator.getActiveCaptureId()).toBe(2);
    expect(coordinator.isActiveCapture(1)).toBe(false);
    expect(coordinator.isActiveCapture(2)).toBe(true);
    expect(a.token.isCancellationRequested).toBe(true);

    coordinator.disposeTokenIfActive(b);
    expect(b.token.isCancellationRequested).toBe(false);
  });

  it('reset limpia capture y token', () => {
    coordinator.prepareRequest(5);
    coordinator.reset();
    expect(coordinator.getActiveCaptureId()).toBe(0);
    expect(coordinator.isActiveCapture(5)).toBe(false);
  });
});
