import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SuiteProvider } from './contexts/SuiteContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SuiteProvider>
          <App />
        </SuiteProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
