import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill for CanvasRenderingContext2D.roundRect for maximum browser/iframe compatibility
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radii?: number | number[]
  ) {
    const r = typeof radii === 'number' ? radii : Array.isArray(radii) ? (radii[0] || 0) : 0;
    const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    return this;
  };
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Space Simulator caught runtime exception:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none font-sans text-white">
          <div className="max-w-md bg-slate-900/90 border border-rose-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">Simulation Engine Recovered</h2>
            <p className="text-xs text-slate-400 mb-4">
              A temporary runtime issue occurred and was safely prevented from crashing the application.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl text-left text-[11px] font-mono text-rose-300/90 mb-5 overflow-auto max-h-28 border border-slate-800">
              {this.state.errorMessage}
            </div>
            <button
              onClick={this.handleRestart}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition active:scale-95 cursor-pointer"
            >
              Resume Space Program
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global safety handlers to prevent unhandled promise or runtime rejections from blanking the screen
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Recovered from unhandled promise rejection in space simulator:', event.reason);
    event.preventDefault();
  });
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
