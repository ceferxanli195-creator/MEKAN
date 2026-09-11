import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './firebase';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

