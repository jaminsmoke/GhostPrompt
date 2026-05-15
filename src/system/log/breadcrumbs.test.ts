/**
 * @file Tests para breadcrumbs del logger.
 */
import { describe, expect, it } from 'vitest';

import { CaptureBreadcrumbStore } from './breadcrumbs';

describe('CaptureBreadcrumbStore', () => {
  it('evicción FIFO al superar el máximo', () => {
    const store = new CaptureBreadcrumbStore(3);
    for (let i = 0; i < 5; i += 1) {
      store.push(1, {
        level: 'INFO',
        message: `m${i}`,
        timestamp: `t${i}`,
      });
    }
    const snap = store.snapshot(1);
    expect(snap.map((b) => b.message)).toEqual(['m2', 'm3', 'm4']);
  });

  it('flushCapture elimina el buffer', () => {
    const store = new CaptureBreadcrumbStore();
    store.push(7, { level: 'INFO', message: 'a', timestamp: 't' });
    store.flushCapture(7);
    expect(store.snapshot(7)).toEqual([]);
  });
});
