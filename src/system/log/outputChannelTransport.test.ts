/**
 * @file Tests del transporte de log hacia el output channel.
 */

import * as vitest from 'vitest';
import { vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

import { formatLocalTime, OutputChannelLogTransport } from './transports/outputChannel';

vitest.describe('formatLocalTime', () => {
  vitest.it('formats ISO string to HH:mm:ss.SSS', () => {
    vitest.expect(formatLocalTime('2026-05-15T10:30:45.123Z')).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/u);
  });

  vitest.it('pads single-digit values with zeros', () => {
    const result = formatLocalTime('2026-01-01T01:02:03.004Z');
    vitest.expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/u);
    vitest.expect(result.length).toBe(12);
  });
});

vitest.describe('OutputChannelLogTransport', () => {
  vitest.it('formatLine renders basic entry', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'INFO',
      module: 'suggest',
      message: 'request-start',
    });
    vitest.expect(line).toContain('[INFO]');
    vitest.expect(line).toContain('[suggest]');
    vitest.expect(line).toContain('request-start');
  });

  vitest.it('formatLine includes data when present', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'DEBUG',
      module: 'engines',
      message: 'perf',
      data: { elapsedMs: 42 },
    });
    vitest.expect(line).toContain('elapsedMs');
    vitest.expect(line).toContain('42');
  });

  vitest.it('formatLine omits data when empty', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'INFO',
      module: 'test',
      message: 'no-data',
      data: {},
    });
    vitest.expect(line).not.toContain('| {}');
  });

  vitest.it('formatLine includes error payload', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'ERROR',
      module: 'suggest',
      message: 'failed',
      error: { name: 'TimeoutError', message: 'request-timeout' },
    });
    vitest.expect(line).toContain('TimeoutError');
    vitest.expect(line).toContain('request-timeout');
  });

  vitest.it('formatLine includes breadcrumb count', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'WARN',
      module: 'suggest',
      message: 'slow',
      breadcrumbs: [
        { level: 'DEBUG', message: 'start', timestamp: '2026-05-15T10:30:44.000Z' },
        { level: 'INFO', message: 'progress', timestamp: '2026-05-15T10:30:44.500Z' },
      ],
    });
    vitest.expect(line).toContain('breadcrumbs=2');
  });

  vitest.it('has stable transport id', () => {
    const transport = new OutputChannelLogTransport();
    vitest.expect(transport.id).toBe('ghostPromptOutputChannel');
  });
});
