import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — catches runtime errors in children and renders fallback UI.
 * Can wrap at App level, Page level, or Section level.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console (in production, this would go to analytics/Sentry)
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback takes priority
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-[50vh] flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
            {/* DripFeed branding */}
            <div className="mb-6">
              <span
                className="text-2xl font-bold text-primary tracking-tight"
                style={{ fontFamily: 'Instrument Serif, serif' }}
              >
                Drip<span className="text-accent">Feed</span>
              </span>
            </div>

            {/* Error heading */}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              We hit an unexpected error. Please try again.
            </p>

            {/* Show error message in development only */}
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-gray-50 border border-gray-200 rounded-md p-3 mb-4 overflow-auto max-h-32 text-error">
                {this.state.error.message}
              </pre>
            )}

            {/* Retry button */}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
