import React, { Component, type ComponentType, type PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full border-2 border-border bg-card p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 border-2 border-destructive/40 bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mt-2">
            HaulBrokr hit an unexpected UI error. You can retry the current view or reload the app.
          </p>
        </div>
        <p className="text-xs text-muted-foreground border border-border bg-muted/40 p-3 break-words">
          {error.message || "Unknown error"}
        </p>
        <div className="flex gap-3 justify-center">
          <Button className="rounded-none font-bold" onClick={resetError}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
          <Button variant="outline" className="rounded-none border-2 font-bold" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}

type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, componentStack: string) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static defaultProps = {
    FallbackComponent: DefaultErrorFallback,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    this.props.onError?.(error, info.componentStack);
  }

  resetError = () => {
    this.setState({ error: null });
  };

  render() {
    const FallbackComponent = this.props.FallbackComponent ?? DefaultErrorFallback;
    if (this.state.error) {
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }
    return this.props.children;
  }
}
