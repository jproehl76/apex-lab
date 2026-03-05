import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem('install_prompt_dismissed');
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (!isStandalone && !dismissed && isSafari) {
      setTimeout(() => setShow(true), 4000);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed left-4 right-4 z-50 card p-4 flex items-start gap-3 xl:hidden"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom) + 8px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.6)' }}>
      <div className="flex-1">
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: '14px', fontWeight: 600, color: '#E8E8F0', marginBottom: 4 }}>Add to Home Screen</div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: '11px', color: '#606070' }}>
          Tap <strong style={{ color: '#9898A8' }}>Share</strong> then <strong style={{ color: '#9898A8' }}>Add to Home Screen</strong> for the full app experience.
        </div>
      </div>
      <button onClick={() => { localStorage.setItem('install_prompt_dismissed', '1'); setShow(false); }}
        className="flex-shrink-0 p-1.5 rounded-lg" style={{ background: '#2E2E3C' }}>
        <X size={14} style={{ color: '#606070' }} />
      </button>
    </div>
  );
}
