import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { RecoveryPanel } from './App';
import { registerServiceWorker } from './storage';
import './styles.css';
import './stability.css';

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

function resetScrollAfterTabChange(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest('.bottom-nav button') : null;
  if (!target) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  });
}

document.addEventListener('click', resetScrollAfterTabChange, { capture: true });

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

registerServiceWorker();
