/**
 * @file Tipos canónicos del subsistema de logging estructurado.
 */

export type LogLevelName = 'DEBUG' | 'ERROR' | 'INFO' | 'WARN';

export type LogLevel = Lowercase<LogLevelName>;

export type Breadcrumb = {
  level: LogLevelName;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type LogEntry = {
  timestamp: string;
  level: LogLevelName;
  module: string;
  message: string;
  captureId?: number;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  breadcrumbs?: Breadcrumb[];
};

export type LogTransport = {
  readonly id: string;
  write: (entry: LogEntry) => Promise<void>;
  dispose: () => Promise<void>;
};

export type EmitPayload = {
  level: LogLevelName;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  cause?: unknown;
};

export type LogEmitSink = {
  emit: (payload: EmitPayload) => void;
};
