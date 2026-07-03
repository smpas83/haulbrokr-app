import React from "react";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-md border-2 border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Configuration error
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">
              HaulBrokr could not start.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A required production integration failed to initialize. Check the
              deployment environment and reload after it is corrected.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
