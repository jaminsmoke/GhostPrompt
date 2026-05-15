import { describe, expect, it, vi } from 'vitest';
import { Logger } from './Logger';
import type { LogEmitSink, EmitPayload } from './emitContract';

describe('Logger', () => {
  it('debug emits payload with correct level and module', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('suggest', sink);
    logger.debug('request-start', { captureId: 1 });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual({
      level: 'DEBUG',
      module: 'suggest',
      message: 'request-start',
      data: { captureId: 1 },
    });
  });

  it('info emits payload with correct level', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('inbound', sink);
    logger.info('message-received');
    expect(emitted[0].level).toBe('INFO');
    expect(emitted[0].module).toBe('inbound');
    expect(emitted[0].message).toBe('message-received');
  });

  it('warn emits payload with correct level', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('engines', sink);
    logger.warn('provider-slow', { provider: 'ollama' });
    expect(emitted[0].level).toBe('WARN');
    expect(emitted[0].data).toEqual({ provider: 'ollama' });
  });

  it('error emits payload with cause', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('suggest', sink);
    const err = new Error('timeout');
    logger.error('request-failed', { captureId: 42 }, err);
    expect(emitted[0].level).toBe('ERROR');
    expect(emitted[0].data).toEqual({ captureId: 42 });
    expect(emitted[0].cause).toBe(err);
  });

  it('works without data parameter', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('test', sink);
    logger.info('no-data');
    expect(emitted[0].data).toBeUndefined();
  });

  it('moduleName is fixed at construction', () => {
    const emitted: EmitPayload[] = [];
    const sink: LogEmitSink = { emit: (p) => emitted.push(p) };
    const logger = new Logger('fixed-module', sink);
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    emitted.forEach((e) => expect(e.module).toBe('fixed-module'));
  });
});
