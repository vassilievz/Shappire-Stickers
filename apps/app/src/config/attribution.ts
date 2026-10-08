/**
 * Atribuição de autoria do Shappire Stickers.
 *
 * IMPORTANTE: esta identificação vive EXCLUSIVAMENTE na interface
 * (abaixo da figurinha na tela de detalhe e no rodapé "Sobre").
 * Ela NUNCA é renderizada dentro da imagem da figurinha,
 * nem gravada nos arquivos exportados (sem marca d'água).
 */

/** Nome de exibição do autor (configurável localmente em Configurações). */
export const DEFAULT_AUTHOR_DISPLAY_NAME = 'Vassiliev';

/** Rótulo da rede social. */
export const INSTAGRAM_LABEL = 'IG';

/** Handle fixo do Instagram. NÃO é clicável como texto dentro da figurinha — é link na UI. */
export const INSTAGRAM_HANDLE = '@vassilievz';

/** URL externa do perfil. */
export const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/vassilievz/';

/**
 * Linha de atribuição exibida abaixo da figurinha no formato:
 * `Vassiliev · IG · @vassilievz`
 */
export function formatAuthorAttribution(authorDisplayName: string): string {
  const name = authorDisplayName.trim() || DEFAULT_AUTHOR_DISPLAY_NAME;
  return `${name} · ${INSTAGRAM_LABEL} · ${INSTAGRAM_HANDLE}`;
}
