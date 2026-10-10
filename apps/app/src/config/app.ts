
export const APP_INFO = {
  name: 'Shappire Stickers',
  shortName: 'Shappire',
  tagline: 'Crie figurinhas para o WhatsApp direto no seu Android',
  description:
    'Estúdio local de figurinhas: importe imagens, recorte, adicione texto e desenhos, ' +
    'organize pacotes e envie para o WhatsApp. Tudo funciona offline, sem contas e sem servidores.',
  version: '0.2.2',
  discordCommunityUrl: 'https://discord.gg/ncT9S6TZ9e',
  publicDownloadUrl: 'https://shappire.tools/stickers',
  repositoryUrl: 'https://github.com/vassilievz/Shappire-Stickers',
  licenseName: 'MIT',
  licenseUrl: 'https://opensource.org/licenses/MIT',
  privacySummary:
    'Nenhum dado sai do seu aparelho. Imagens, projetos e pacotes ficam armazenados ' +
    'exclusivamente no armazenamento interno do aplicativo.',
} as const;


export const APP_LIMITS = {
  
  recentProjects: 4,
  
  maxStoredProjects: 200,
  
  projectThumbnailSize: 192,
} as const;
