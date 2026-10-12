# Arquitetura (offline-first)

O Shappire Stickers é um app Capacitor com UI em React e persistência local via Filesystem/Preferences.

```text
apps/app/src/
  features/     Telas (home, editor, pacotes, configurações)
  domain/       Modelos e regras do WhatsApp
  services/     Imagens, pacotes, WhatsApp nativo, storage
  state/        Zustand (biblioteca, editor, configurações)
```

Não há backend obrigatório, autenticação nem sincronização em nuvem no fluxo principal.
