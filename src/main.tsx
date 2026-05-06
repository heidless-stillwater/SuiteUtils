import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SuiteProvider } from './contexts/SuiteContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';

// GLOBAL API INTERCEPTOR: Inject active workspace ID into all suite-utils API calls
const originalFetch = window.fetch;
window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
  const workspaceId = localStorage.getItem('activeWorkspaceId') || 'stillwater-suite';
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url.includes(':5185/api') || url.includes(':5181/api')) {
    const headers = new Headers(init?.headers || {});
    if (!headers.has('x-workspace-id')) {
      headers.set('x-workspace-id', workspaceId);
    }
    return originalFetch(input, { ...init, headers });
  }
  
  return originalFetch(input, init);
};

// Error Boundary to prevent white-screen crashes
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SuiteUtils] Render crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          padding: '2rem',
        }}>
          <div style={{ maxWidth: '500px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#ef4444' }}>
              SuiteUtils — Render Error
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {this.state.error?.message}
            </p>
            <pre style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '1rem',
              borderRadius: '0.75rem',
              fontSize: '0.75rem',
              color: '#cbd5e1',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: '300px',
            }}>
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #0d9488, #10b981)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <SuiteProvider>
              <App />
            </SuiteProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
