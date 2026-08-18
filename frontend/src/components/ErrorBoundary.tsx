import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({
  error,
  resetError
}) => (
  /*
   * Inline styles, but reading the same tokens as everything else: this renders
   * when the app has already failed, so it must not depend on a CSS module
   * having loaded -- while the :root custom properties in App.css have.
   */
  <div style={{
    padding: '20px',
    margin: '20px',
    border: '1px solid var(--danger-rule)',
    backgroundColor: 'var(--danger-bg)',
    color: 'var(--danger-ink)'
  }}>
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      letterSpacing: '0.2em',
      color: 'var(--danger)'
    }}>
      ERROR
    </div>
    <h2 style={{ margin: '4px 0 16px 0', fontSize: '18px', color: 'var(--ink)' }}>
      Something went wrong
    </h2>
    <details style={{ marginBottom: '16px' }}>
      <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
      <pre style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        backgroundColor: 'var(--paper-field)',
        border: '1px solid var(--danger-rule)',
        padding: '8px',
        whiteSpace: 'pre-wrap'
      }}>
        {error.message}
      </pre>
    </details>
    <button
      onClick={resetError}
      style={{
        padding: '12px 22px',
        backgroundColor: 'var(--danger)',
        color: 'var(--paper)',
        border: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
);