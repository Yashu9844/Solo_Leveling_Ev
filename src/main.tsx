import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Self-hosted so the app still renders correctly offline — it makes no
// network requests by design. Latin subsets only, and only the weights
// design/00-DESIGN-SYSTEM.md §4 actually names: eight files, not the
// ~90 a bare `@fontsource/inter` import would pull in.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/cormorant-garamond/latin-300.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

import './index.css';
import { App } from './App';
import { ArcStatusProvider } from './store/ArcStatusContext';
import { SettingsProvider } from './store/SettingsContext';
import { MotionRoot } from './ui/MotionRoot';
import { OverlayStackProvider } from './ui/routing/OverlayStack';

if ('storage' in navigator && 'persist' in navigator.storage) {
  void navigator.storage.persist();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <MotionRoot>
        {/*
          Both v7 flags opted into early. Without them React Router logs
          two "Future Flag Warning" lines on every boot, and adopting the
          behaviour now means the v7 upgrade is not also a behaviour
          change. Verified against the full suite — including the 300ms
          tap budget, which v7_startTransition could plausibly have
          disturbed by making router updates interruptible.
        */}
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <OverlayStackProvider>
            <ArcStatusProvider>
              <App />
            </ArcStatusProvider>
          </OverlayStackProvider>
        </BrowserRouter>
      </MotionRoot>
    </SettingsProvider>
  </StrictMode>
);
