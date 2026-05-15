import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { postToHost } from '../hooks/useGhostPrompt';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    postToHost({
      type: 'log',
      level: 'error',
      message: 'react-error-boundary',
      data: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="p-4"
          style={{
            background: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
          }}
        >
          <h2 style={{ color: 'var(--vscode-errorForeground)' }}>Error en GhostPrompt</h2>
          <pre
            className="mt-2 p-2 rounded text-sm"
            style={{
              background: 'var(--vscode-textBlockQuote-background)',
              border: '1px solid var(--vscode-widget-border)',
              overflow: 'auto',
              maxHeight: 200,
            }}
          >
            {this.state.error?.message ?? 'Error desconocido'}
          </pre>
          <button
            type="button"
            className="mt-3 px-4 py-2 rounded-md text-sm font-semibold"
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
            }}
            onClick={this.handleReload}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
