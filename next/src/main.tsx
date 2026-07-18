import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { RecoveryPanel } from './App';
import { registerServiceWorker } from './storage';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BONSAI fatal]', error, info.componentStack);
  }

  render() {
    return this.state.error ? <RecoveryPanel error={this.state.error} /> : this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('BONSAI root element was not found');

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

registerServiceWorker();
