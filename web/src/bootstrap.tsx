/** Mounts the React tree (kept separate so main.tsx can do theme setup first). */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppStateProvider } from './state/AppState';
import { NavProvider } from './nav/navigation';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <AppStateProvider>
      <NavProvider initial="schedule">
        <App />
      </NavProvider>
    </AppStateProvider>
  </StrictMode>,
);
