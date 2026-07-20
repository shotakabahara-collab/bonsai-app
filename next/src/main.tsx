import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { RecoveryPanel } from './App';
import { CompletionLayer } from './CompletionLayer';
import { registerServiceWorker } from './storage';
import './styles.css';
import './stability.css';
import './completion-layer.css';
import './quality-v2.css';
import './craft-v3.css';
import './seasonal-v4.css';
import './authentic-v5.css';
import './photoreal-v6.css';

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
(window as Window & { BonsaiRelease?: string }).BonsaiRelease = 'bonsai-photoreal-craft-v7-20260720';

createRoot(root).render(
  <ErrorBoundary>
    <App />
    <CompletionLayer />
  </ErrorBoundary>
);

registerServiceWorker();
