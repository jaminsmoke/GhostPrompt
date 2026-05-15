/**
 * @file Manejador de errores React para el webview GhostPrompt.
 */
import { Component } from 'react';

import { postToHost } from '../hooks/useGhostPrompt';

import type { ErrorInfo, ReactNode } from 'react';

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
        <div className="error-boundary p-4">
          <h2 className="error-boundary__title">Error en GhostPrompt</h2>
          <pre className="error-boundary__details mt-2 p-2 rounded text-sm">
            {this.state.error?.message ?? 'Error desconocido'}
          </pre>
          <button
            type="button"
            className="error-boundary__retry mt-3 px-4 py-2 rounded-md text-sm font-semibold"
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
