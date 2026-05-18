/**
 * @file Tests para el logger principal y su registro de eventos.
 */

import * as vitest from 'vitest';

import { Logger } from './Logger';

import type { LogEmitSink, EmitPayload } from './emitContract';

vitest.describe('Logger', () => {
  vitest.it('debug emits payload with correct level and module', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('suggest', sink);
    logger.debug('request-start', { captureId: 1 });
    vitest.expect(emitted).toHaveLength(1);
    vitest.expect(emitted[0]).toEqual({
      level: 'DEBUG',
      module: 'suggest',
      message: 'request-start',
      data: { captureId: 1 },
    });
  });

  vitest.it('info emits payload with correct level', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('inbound', sink);
    logger.info('message-received');
    vitest.expect(emitted[0].level).toBe('INFO');
    vitest.expect(emitted[0].module).toBe('inbound');
    vitest.expect(emitted[0].message).toBe('message-received');
  });

  vitest.it('warn emits payload with correct level', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('engines', sink);
    logger.warn('provider-slow', { provider: 'ollama' });
    vitest.expect(emitted[0].level).toBe('WARN');
    vitest.expect(emitted[0].data).toEqual({ provider: 'ollama' });
  });

  vitest.it('error emits payload with cause', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('suggest', sink);
    const err = new Error('timeout');
    logger.error('request-failed', { captureId: 42 }, err);
    vitest.expect(emitted[0].level).toBe('ERROR');
    vitest.expect(emitted[0].data).toEqual({ captureId: 42 });
    vitest.expect(emitted[0].cause).toBe(err);
  });

  vitest.it('works without data parameter', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('test', sink);
    logger.info('no-data');
    vitest.expect(emitted[0].data).toBeUndefined();
  });

  vitest.it('moduleName is fixed at construction', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('fixed-module', sink);
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    for (const entry of emitted) {
      vitest.expect(entry.module).toBe('fixed-module');
    }
  });
});
