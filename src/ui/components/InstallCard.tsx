import { useEffect, useState } from 'react';
import { Panel, SecondaryButton } from '../kit';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** final/08's ship checklist — a real install prompt, not just a
 * manifest sitting unused. Android's beforeinstallprompt event is the
 * only reliable cross-browser signal that installing is currently
 * possible; iOS Safari never fires it (no programmatic install there
 * at all), so this card simply never appears on iOS rather than
 * showing a button that would do nothing. */
export function InstallCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="mt-4" data-testid="install-card">
      <Panel cut="md" bodyClassName="px-4 py-4">
        <p className="text-sm text-ink-100">Install this as an app.</p>
        <p className="mt-1.5 text-xs text-faint">Full screen, works offline, no browser chrome.</p>
        <div className="mt-4">
          <SecondaryButton onClick={() => void handleInstall()}>Install</SecondaryButton>
        </div>
      </Panel>
    </div>
  );
}
