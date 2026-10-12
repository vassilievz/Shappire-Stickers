import { useCallback, useEffect, useState } from 'react';
import {
  getPackAddedState,
  getWhatsAppCapabilities,
  type WhatsAppCapabilities,
} from '@/services/whatsapp/whatsappService';

export function usePackWhatsAppState(packId: string) {
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [addedState, setAddedState] = useState<{ consumer: boolean | null; business: boolean | null } | null>(
    null,
  );

  const reloadWhatsAppState = useCallback(async () => {
    const caps = await getWhatsAppCapabilities();
    setCapabilities(caps);
    if (caps.nativeAvailable) {
      setAddedState(await getPackAddedState(packId));
    }
  }, [packId]);

  useEffect(() => {
    void reloadWhatsAppState();
  }, [reloadWhatsAppState]);

  return { capabilities, addedState, reloadWhatsAppState };
}
