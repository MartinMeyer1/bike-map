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
  <div style={{
    padding: '20px',
    margin: '20px',
    border: '1px solid #dc3545',
    borderRadius: '8px',
    backgroundColor: '#f8d7da',
    color: '#721c24'
  }}>
    <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Something went wrong</h2>
    <details style={{ marginBottom: '16px' }}>
      <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
      <pre style={{ 
        fontSize: '12px', 
        backgroundColor: '#fff', 
        padding: '8px', 
        borderRadius: '4px',
        whiteSpace: 'pre-wrap'
      }}>
        {error.message}
      </pre>
    </details>
    <button
      onClick={resetError}
      style={{
        padding: '8px 16px',
        backgroundColor: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Try again
    </button>
  </div>
);