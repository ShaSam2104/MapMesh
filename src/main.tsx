import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { installBrowserLogBridge } from '@/lib/log/browser';
import { tagged } from '@/lib/log/logger';
import { App } from './App';
import { ErrorFallback } from '@/components/layout/ErrorFallback';
import './index.css';

installBrowserLogBridge();
const log = tagged('boot');
log.info('app ready');

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => log.error('uncaught', { error, info })}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
