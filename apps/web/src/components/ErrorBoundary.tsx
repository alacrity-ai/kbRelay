import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * App-wide guardrail. A render throw anywhere below unmounts the whole React
 * tree to a blank page by default — this catches it and shows a recoverable
 * panel instead. Defense in depth (the real drag fix lives in Board).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface to the console for debugging; no external reporting in v0.1.0.
    console.error('kbRelay crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="center">
          <div className="gate">
            <div className="brand"><span className="brand-mark">kb</span> kbRelay</div>
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Something went wrong</h1>
            <p className="muted-note">{this.state.error.message}</p>
            <button className="primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
