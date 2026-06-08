import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SocketProvider } from './context/SocketContext.tsx';
import { LanguageProvider } from './translations.tsx';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker with auto-update
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SocketProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </SocketProvider>
  </StrictMode>,
);
