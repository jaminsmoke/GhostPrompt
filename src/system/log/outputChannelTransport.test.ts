import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}));

import { formatLocalTime, OutputChannelLogTransport } from './transports/outputChannel';

describe('formatLocalTime', () => {
  it('formats ISO string to HH:mm:ss.SSS', () => {
    expect(formatLocalTime('2026-05-15T10:30:45.123Z')).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('pads single-digit values with zeros', () => {
    const result = formatLocalTime('2026-01-01T01:02:03.004Z');
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(result.length).toBe(12);
  });
});

describe('OutputChannelLogTransport', () => {
  it('formatLine renders basic entry', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'INFO',
      module: 'suggest',
      message: 'request-start',
    });
    expect(line).toContain('[INFO]');
    expect(line).toContain('[suggest]');
    expect(line).toContain('request-start');
  });

  it('formatLine includes data when present', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'DEBUG',
      module: 'engines',
      message: 'perf',
      data: { elapsedMs: 42 },
    });
    expect(line).toContain('elapsedMs');
    expect(line).toContain('42');
  });

  it('formatLine omits data when empty', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'INFO',
      module: 'test',
      message: 'no-data',
      data: {},
    });
    expect(line).not.toContain('| {}');
  });

  it('formatLine includes error payload', () => {
    const transport = new OutputChannelLogTransport();
    const line = transport.formatLine({
      timestamp: '2026-05-15T10:30:45.123Z',
      level: 'ERROR',
      module: 'suggest',
      message: 'failed',
      error: { name: 'TimeoutError', message: 'request-timeout' },
    });
    expect(line).toContain('TimeoutError');
    expect(line).toContain('request-timeout');
  });

  it('formatLine includes breadcrumb count', () => {
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
    expect(line).toContain('breadcrumbs=2');
  });

  it('has stable transport id', () => {
    const transport = new OutputChannelLogTransport();
    expect(transport.id).toBe('ghostPromptOutputChannel');
  });
});
