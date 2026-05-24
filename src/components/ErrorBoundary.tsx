import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="fw-card max-w-md p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-secondaryText">
            An unexpected error interrupted the page. Reload to continue — your account and lessons are unaffected.
          </p>
          {this.state.error?.message && (
            <p className="mt-3 break-words text-xs text-secondaryText/80">
              {this.state.error.message}
            </p>
          )}
          <button onClick={this.reset} className="btn-primary mt-6 inline-flex">
            <RefreshCcw className="h-4 w-4" /> Back to home
          </button>
        </div>
      </main>
    );
  }
}
