# Shappire Stickers

**Shappire Stickers** é um aplicativo Android **offline-first** para criar, editar e gerenciar pacotes de figurinhas do WhatsApp.

React, TypeScript, Capacitor e integração nativa com o WhatsApp — sem conta, sem backend e sem internet para o fluxo principal.

## Funcionalidades

- Editor de figurinhas (512×512): camadas, texto, desenho, recorte e remoção de fundo local.
- Projetos e pacotes salvos no dispositivo.
- Exportação nos formatos exigidos pelo WhatsApp.
- Adicionar pacotes ao WhatsApp via plugin nativo Android.

## Requisitos

- Node.js 20+
- npm 10+
- Android SDK (para build do APK)

## Desenvolvimento

```bash
npm install
npm run app:dev
```

## Build e Android

```bash
npm run build
npm run cap:sync
npm run android:debug
```

APK debug: `apps/app/android/app/build/outputs/apk/debug/app-debug.apk`

## Estrutura

```text
apps/app/     App React + Capacitor (único pacote do monorepo)
```

## Privacidade

Imagens, projetos e pacotes permanecem no armazenamento interno do app. Não há login, sincronização em nuvem nem chamadas de API na inicialização.

## Licença

MIT — ver `LICENSE`.
