import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. Please try again or return to the
                home page.
              </p>
            </div>
            <Button onClick={this.reset} className="font-semibold">
              <RefreshCw className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
