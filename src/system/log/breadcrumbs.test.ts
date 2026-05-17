/**
 * @file Tests para breadcrumbs del logger.
 */
import * as vitest from 'vitest';

import { CaptureBreadcrumbStore } from './breadcrumbs';

vitest.describe('CaptureBreadcrumbStore', () => {
  vitest.it('evicción FIFO al superar el máximo', () => {
    const store = new CaptureBreadcrumbStore(3);
    for (let index = 0; index < 5; index += 1) {
      store.push(1, {
        level: 'INFO',
        message: `m${index}`,
        timestamp: `t${index}`,
      });
    }
    const snap = store.snapshot(1);
    vitest.expect(snap.map((b) => b.message)).toEqual(['m2', 'm3', 'm4']);
  });

  vitest.it('flushCapture elimina el buffer', () => {
    const store = new CaptureBreadcrumbStore();
    store.push(7, { level: 'INFO', message: 'a', timestamp: 't' });
    store.flushCapture(7);
    vitest.expect(store.snapshot(7)).toEqual([]);
  });
});
