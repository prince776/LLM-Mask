import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { UserProvider } from './contexts/UserContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { NotificationProvider } from './contexts/NotificationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorProvider>
      <UserProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </UserProvider>
    </ErrorProvider>
  </StrictMode>
);
