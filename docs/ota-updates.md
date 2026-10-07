# OtaKit Over-The-Air (OTA) Updates — Shappire Stickers

Este documento descreve o funcionamento, configuração, ciclo de lançamento e diretrizes de segurança do sistema de atualizações Over-The-Air (**OtaKit**) integrado ao **Shappire Stickers**.

---

## 1. O que o OtaKit faz?

O OtaKit permite distribuir atualizações instantâneas da camada web do aplicativo (React, TypeScript, CSS, UI, lógica do editor) diretamente para os aparelhos dos usuários, **sem a necessidade de gerar um novo arquivo APK nem depender da Google Play Store**.

O aplicativo permanece **100% offline-first**. O OtaKit atua unicamente como o mecanismo de entrega e substituição atômica dos arquivos estáticos da WebView (`dist/`).

- **App ID no OtaKit:** `c4cf6be0-def9-480d-936e-0be638499ca3`
- **Label do App:** `shappiresticker`
- **Plugin Oficial:** `@otakit/capacitor-updater`

---

## 2. Como as atualizações funcionam?

```
Desenvolvedor altera código (React / TS / CSS)
       ↓
git push origin main
       ↓
GitHub Actions (npm ci → typecheck → test → build)
       ↓
OtaKit CLI: upload dist --release --fail-on-incompatible
       ↓
Dispositivos com Shappire Stickers detectam a atualização
       ↓
Download seguro em segundo plano (background)
       ↓
Bundle é preparado (staged) localmente
       ↓
Ativação na próxima inicialização do app (cold launch)
       ↓
App confirma saúde via notifyAppReady()
```

1. **Detecção e Download em Segundo Plano:** O plugin verifica novas versões e faz o download em segundo plano sem travar a interface.
2. **Sem Interrupções no Editor:** O app **nunca** força um reinício automático enquanto o usuário está editando, recortando ou criando figurinhas.
3. **Ativação Segura:** A nova versão é aplicada na próxima inicialização a frio (*cold start*) do aplicativo ou quando o usuário optar manualmente por *"Reiniciar agora"* na tela de Ajustes.
4. **Confirmação de Saúde (*Health Check*):** Ao iniciar o bundle atualizado, o aplicativo chama `OtaKit.notifyAppReady()`. Se o bundle falhar em inicializar (erro fatal de JS ou timeout de 10s), o OtaKit reverte automaticamente para a versão estável anterior (*rollback*).

---

## 3. O que o OTA PODE atualizar?

O OTA atualiza exclusivamente a camada web empacotada no diretório `dist/`:

- Componentes React e telas (`src/features/`, `src/app/`, `src/shared/`).
- Estilos Tailwind CSS e animações (`src/styles/`).
- Lógica de edição do Konva e manipulação de canvas no navegador.
- Traduções e textos (`src/i18n/`).
- Correções de bugs na interface ou regras de validação frontend.
- Novas funcionalidades que não exijam código nativo.

---

## 4. O que EXIGE um novo build nativo Android (APK)?

O OTA **NÃO PODE** atualizar código nativo. As seguintes alterações exigem gerar um novo APK (`./gradlew.bat assembleDebug` ou build de Release assinado):

- Código Kotlin/Java (`android/app/src/main/java/**`).
- `MainActivity.kt`.
- `StickerPackPlugin.kt` e `StickerContentProvider.kt` (integração do WhatsApp).
- `AndroidManifest.xml` e permissões nativas (`READ_MEDIA_IMAGES`, etc.).
- Instalação, remoção ou atualização de plugins do Capacitor (`@capacitor/*`).
- Configurações do SDK Android, `compileSdk`, `targetSdk`, dependências Gradle.

> ⚠️ **AVISO CRÍTICO:** Nunca publique via OTA alterações que dependam de recursos nativos não presentes no APK já instalado nos aparelhos. O comando de publicação utiliza a flag `--fail-on-incompatible` para interromper lançamentos que violem a compatibilidade nativa.

---

## 5. Como criar e publicar um OTA manualmente

Caso queira fazer o upload de uma atualização via terminal local:

1. Gere o build de produção do frontend:
   ```bash
   npm run build
   ```

2. Defina o token de autenticação:
   ```powershell
   $env:OTAKIT_TOKEN = "seu-token-otakit"
   ```

3. Faça o upload e publicação:
   ```bash
   npx -y @otakit/cli@latest upload dist --release --fail-on-incompatible
   ```

---

## 6. Publicação Automática via GitHub Actions

O repositório conta com a workflow em `.github/workflows/ota.yml`.

A cada `git push origin main`:
1. Valida tipagem (`npm run typecheck`).
2. Executa a suíte de testes (`npm run test`).
3. Compila a aplicação (`npm run build`).
4. Publica a versão no OtaKit usando o segredo `OTAKIT_TOKEN`.

Filtros de caminho (`paths-ignore`) garantem que alterações exclusivas do Android nativo (`android/**`) ou da documentação **não** disparem lançamentos OTA.

---

## 7. Configuração do Segredo no GitHub (Secret)

Para que o GitHub Actions consiga autenticar e publicar no OtaKit:

1. Acesse o repositório no GitHub:
   `https://github.com/vassilievz/Shappire-Stickers`
2. Vá em **Settings** → **Secrets and variables** → **Actions**.
3. Clique em **New repository secret**.
4. Nome:
   ```
   OTAKIT_TOKEN
   ```
5. Valor: Insira o token de API / organização gerado no painel do OtaKit (`console.otakit.app`).
6. Clique em **Add secret**.

> 🔒 **Segurança:** Nunca comite nem exponha o token no código-fonte, `capacitor.config.ts`, `.env` rastreado ou arquivos públicos.

---

## 8. Interface do Usuário (Ajustes)

Na aba **Ajustes** (`/configuracoes`), foi adicionada a seção **Atualizações**:
- Exibe a versão atual ativa (informada pelo OtaKit no dispositivo).
- Botão **[Verificar atualizações]**: consulta o manifesto do canal.
- Botão **[Atualizar agora]**: faz o download e prepara o novo bundle.
- Botão **[Reiniciar agora]**: aplica a atualização imediatamente e recarrega a WebView.

---

## 9. Como funciona o Rollback de Segurança

1. Ao carregar um novo bundle OTA, o OtaKit inicia um temporizador de 10 segundos em primeiro plano.
2. O aplicativo executa sua montagem e hidratação de configurações no React.
3. Ao finalizar, o app chama `OtaKit.notifyAppReady()`.
4. Se ocorrer um erro em tempo de execução que impeça a chamada de `notifyAppReady()`, o OtaKit descarta o bundle corrompido e restaura automaticamente a versão builtin ou a última versão que estava estável.
