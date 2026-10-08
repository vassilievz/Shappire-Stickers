import { Capacitor } from '@capacitor/core';

/**
 * Abre um link externo (ex.: perfil do Instagram) fora do WebView.
 *
 * No Android/Capacitor, qualquer navegação para um host fora do app passa por
 * `BridgeWebViewClient.shouldOverrideUrlLoading` → `bridge.launchIntent(url)`,
 * que dispara um Intent `ACTION_VIEW` — abrindo o browser/app externo.
 * Uma navegação direta (`window.location.href`) é o caminho mais confiável;
 * `window.open` pode ser bloqueado ou abrir dentro do próprio WebView.
 *
 * @param url URL http(s) completa.
 * @returns true se a navegação foi iniciada com sucesso.
 */
export function openExternalLink(url: string): boolean {
  if (!url) return false;

  // Validação simples: apenas http(s) e sem caracteres perigosos.
  if (!/^https?:\/\/[^\s"<>]+$/i.test(url)) return false;

  try {
    if (Capacitor.isNativePlatform()) {
      // No nativo, navegação de top-level → launchIntent → ACTION_VIEW externo.
      window.location.href = url;
      return true;
    }

    // Ambiente web: nova aba, isolada do app.
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    // Último recurso: tentar abrir via anchor programático.
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch {
      return false;
    }
  }
}
