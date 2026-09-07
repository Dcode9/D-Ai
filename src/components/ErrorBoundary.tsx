import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
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
    console.error("D'Ai runtime error captured by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#1c1b1a] px-6 text-center text-[#efe3c6]">
          <div className="max-w-md rounded-lg border border-[#c9a86a]/40 bg-[#151413] p-8 shadow-[0_0_24px_rgba(201,168,106,0.2)]">
            <h1 className="font-display text-3xl italic tracking-wide text-[#efe3c6]">
              A moment of stillness.
            </h1>
            <p className="mt-3 font-body text-sm text-[#8f8574]">
              An unexpected disturbance occurred in the rendering stream.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-6 cursor-pointer rounded border border-[#c9a86a] bg-[#c9a86a]/15 px-6 py-2 font-display text-lg text-[#fff3d6] transition-all hover:bg-[#c9a86a]/30 active:scale-95"
            >
              Restore D’Ai
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
