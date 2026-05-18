/**
 * @file Tests del coordinador de peticiones de suggestion.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

vi.mock('vscode', () => ({
  'CancellationTokenSource': class {
    token = { isCancellationRequested: false };
    cancel(): void {
      this.token.isCancellationRequested = true;
    }
    dispose(): void {}
  },
}));

import { SuggestionRequestCoordinator } from './suggestionRequestCoordinator';

const TEST_CAPTURE_ID = 5;

vitest.describe('SuggestionRequestCoordinator', () => {
  let coordinator: SuggestionRequestCoordinator;

  vitest.beforeEach(() => {
    coordinator = new SuggestionRequestCoordinator();
  });

  vitest.it('prepareRequest fija capture activo y cancela token anterior', () => {
    const a = coordinator.prepareRequest(1);
    vitest.expect(coordinator.getActiveCaptureId()).toBe(1);
    vitest.expect(coordinator.isActiveCapture(1)).toBe(true);

    const b = coordinator.prepareRequest(2);
    vitest.expect(coordinator.getActiveCaptureId()).toBe(2);
    vitest.expect(coordinator.isActiveCapture(1)).toBe(false);
    vitest.expect(coordinator.isActiveCapture(2)).toBe(true);
    vitest.expect(a.token.isCancellationRequested).toBe(true);

    coordinator.disposeTokenIfActive(b);
    vitest.expect(b.token.isCancellationRequested).toBe(false);
  });

  vitest.it('reset limpia capture y token', () => {
    coordinator.prepareRequest(TEST_CAPTURE_ID);
    coordinator.reset();
    vitest.expect(coordinator.getActiveCaptureId()).toBe(0);
    vitest.expect(coordinator.isActiveCapture(TEST_CAPTURE_ID)).toBe(false);
  });
});
