/**
 * @file Tests para breadcrumbs del logger.
 */
import * as vitest from 'vitest';

import { CaptureBreadcrumbStore } from './breadcrumbs';

const TEST_BREADCRUMB_STORE_MAX = 3;
const TEST_BREADCRUMB_OVERFLOW_PUSH_COUNT = 5;
const TEST_BREADCRUMB_CAPTURE_ID = 1;
const TEST_FLUSH_CAPTURE_ID = 7;

vitest.describe('CaptureBreadcrumbStore', () => {
  vitest.it('evicción FIFO al superar el máximo', () => {
    const store = new CaptureBreadcrumbStore(TEST_BREADCRUMB_STORE_MAX);
    for (let index = 0; index < TEST_BREADCRUMB_OVERFLOW_PUSH_COUNT; index += 1) {
      store.push(TEST_BREADCRUMB_CAPTURE_ID, {
        level: 'INFO',
        message: `m${index}`,
        timestamp: `t${index}`,
      });
    }
    const snap = store.snapshot(TEST_BREADCRUMB_CAPTURE_ID);
    vitest.expect(snap.map((b) => b.message)).toEqual(['m2', 'm3', 'm4']);
  });

  vitest.it('flushCapture elimina el buffer', () => {
    const store = new CaptureBreadcrumbStore();
    store.push(TEST_FLUSH_CAPTURE_ID, { level: 'INFO', message: 'a', timestamp: 't' });
    store.flushCapture(TEST_FLUSH_CAPTURE_ID);
    vitest.expect(store.snapshot(TEST_FLUSH_CAPTURE_ID)).toEqual([]);
  });
});
