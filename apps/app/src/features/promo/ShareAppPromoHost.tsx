import { useEffect, useState } from 'react';
import { ShareAppPromoDialog } from './ShareAppPromoDialog';
import { shouldShowSharePromo } from './shareAppPromoStorage';

const OPEN_DELAY_MS = 1_100;

export interface ShareAppPromoHostProps {
  /** App shell is hydrated and splash sequence can finish. */
  appReady: boolean;
}

export function ShareAppPromoHost({ appReady }: ShareAppPromoHostProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!appReady) return undefined;
    if (!shouldShowSharePromo()) return undefined;

    const timer = window.setTimeout(() => {
      if (shouldShowSharePromo()) {
        setOpen(true);
      }
    }, OPEN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [appReady]);

  return <ShareAppPromoDialog open={open} onClose={() => setOpen(false)} />;
}
