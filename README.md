# Shappire Stickers

Aplicativo Android offline para **criar, editar e empacotar figurinhas (stickers) para o WhatsApp**.

> Estado do projeto: **v0.1.0 — primeira versão funcional**. O editor, a biblioteca de
> pacotes, a persistência local e a exportação WebP estão implementados e testados.
> A integração nativa com o WhatsApp foi implementada em Kotlin seguindo a documentação
> oficial, mas **ainda não foi compilada/validada em um dispositivo** neste ambiente
> (veja [Limitações conhecidas](#limitações-conhecidas)).

---

## Descrição

O Shappire Stickers é um estúdio local de figurinhas:

- importa imagens da galeria do Android;
- edita em um canvas 512 × 512 com imagem, texto, desenho e recorte;
- organiza o resultado em pacotes compatíveis com a bandeja do WhatsApp;
- exporta WebP real (com transparência e codificação otimizada) e envia o pacote ao WhatsApp.

**Nada sai do aparelho.** Não existe backend, conta, login, telemetria ou sincronização.

---

## Funcionalidades implementadas

### Editor

- **Importação de imagens** (PNG, JPEG, WebP) pelo seletor do Android (Photo Picker via
  `@capacitor/camera`), com fallback para o seletor de documentos do sistema.
  Imagens grandes são reduzidas antes de serem gravadas (limite de memória).
- **Canvas 512 × 512** em Konva/React-Konva, com quadriculado de transparência apenas visual.
- **Manipulação**: arrastar, redimensionar, girar, selecionar, duplicar, travar e ocultar.
- **Zoom e movimentação** por pinça (dois dedos), roda do mouse e botões, sem interferir
  nas ferramentas de manipulação.
- **Texto**: conteúdo multilinha, fonte (5 famílias locais), tamanho, cor, alinhamento,
  espaçamento entre linhas, contorno e sombra.
- **Desenho livre** com pincel colorido e borracha; desfazer último traço e limpar tudo.
- **Recorte manual**: apagar áreas com o dedo (`máscara`) e restaurar (`restaurar`), com
  contorno de seleção. A máscara respeita a transparência original.
- **Contorno real** ao redor da silhueta, com cor e espessura configuráveis, aplicado na
  exportação (dilatação da silhueta + redesenho da imagem).
- **Camadas**: reordenar, ocultar, travar e remover.
- **Histórico real** de desfazer/refazer (limite configurável, 40 operações), incluindo
  agrupamento da edição de texto em uma única operação.
- **Salvamento local** automático e manual, com miniatura gerada para as listas.

### Exportação

- WebP 512 × 512 **com transparência**, codificado de verdade pelo WebView (`toBlob`),
  nunca renomeando PNG.
- Reamostragem de qualidade decrescente (0,95 → 0,5) até o arquivo caber em 100 KB.
- Ícone da bandeja (tray) 96 × 96 em PNG, recodificado em WebP se passar de 50 KB.
- Mensagens claras quando a figurinha ultrapassa os limites.
- Compartilhamento de uma figurinha individual via `@capacitor/share`.

### Pacotes

- Criar, renomear, excluir (com confirmação), listar e abrir.
- Adicionar (do editor ou importando imagem pronta), remover e **reordenar** figurinhas.
- Emojis (1–3) e texto de acessibilidade por figurinha.
- Ícone do pacote automático (primeira figurinha) ou escolhido manualmente.
- Validação completa das regras oficiais antes de permitir o envio; pacotes inválidos
  não podem ser exportados.
- `image_data_version` incrementado automaticamente apenas quando o conteúdo muda.

### Integração com o WhatsApp (Android)

- Plugin Capacitor próprio em **Kotlin** (`StickerPackPlugin`).
- **ContentProvider** nativo (`StickerContentProvider`) que serve `contents.json` e as
  imagens ao WhatsApp, seguindo o contrato oficial do projeto WhatsApp/stickers.
- Intent oficial `com.whatsapp.intent.action.ENABLE_STICKER_PACK` com retorno de
  resultado (adicionado / cancelado / erro de validação).
- Verificação de instalação do WhatsApp e do WhatsApp Business, com atalho para a Play Store.
- Consulta da **whitelist oficial** para saber se o pacote já foi adicionado.
- Validação dupla: regras em TypeScript + leitura real dos arquivos no dispositivo
  (existência, tamanho, cabeçalho RIFF/WEBP e dimensões 512 × 512 via `BitmapFactory`).

### Interface

- Tema escuro sofisticado (grafite/preto/branco), tema claro opcional, sem gradientes
  decorativos nem excesso de cards.
- Ícones Lucide, animações discretas, áreas de toque ≥ 44 px, respeito às safe areas.
- **Interface 100% em português brasileiro**, incluindo estados vazios e mensagens de erro.

---

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| UI | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Estilo | Tailwind CSS 4 |
| Estado | Zustand 5 |
| Editor visual | Konva 10 + React-Konva 19 |
| App nativo | Capacitor 8 (Android) |
| Plugins nativos | `@capacitor/camera`, `filesystem`, `share`, `app`, `preferences`, `splash-screen`, `status-bar` |
| Android | Kotlin (plugin + ContentProvider), Gradle/AGP |
| Testes | Vitest 5 + Testing Library (jsdom) |
| Ícones | Lucide React |

---

## Requisitos de desenvolvimento

- **Node.js 20+** (desenvolvido com Node 24) e npm 10+.
- **Android Studio** (Ladybug ou mais recente), **JDK 21** e **Android SDK 36**
  (`compileSdk`/`targetSdk` = 36, `minSdk` = 24).
- Nenhum acesso à internet é necessário em tempo de execução; a instalação inicial
  das dependências npm e do Gradle requer rede.

---

## Instalação

```bash
npm install
```

---

## Executar o frontend (navegador)

```bash
npm run dev        # servidor de desenvolvimento (http://localhost:5173)
npm run build      # typecheck + build de produção em dist/
npm run preview    # pré-visualiza o build
```

No navegador o aplicativo roda normalmente, **exceto** os recursos que dependem do Android
(adicionar ao WhatsApp, compartilhar arquivos e a gravação no diretório privado real).
Nesses casos a interface mostra uma mensagem verdadeira de indisponibilidade — nada é
simulado.

Comandos de qualidade:

```bash
npm run typecheck  # TypeScript (strict) sem emissão
npm run lint       # ESLint
npm test           # Vitest (13 arquivos, 121 testes)
npm run check      # typecheck + testes + build
```

---

## Configurar o Capacitor

A configuração fica em [`capacitor.config.ts`](capacitor.config.ts):

- `appId: com.shappire.stickers` → define o `applicationId` do Android e a authority do
  ContentProvider (`com.shappire.stickers.stickercontentprovider`).
- `webDir: dist` → pasta gerada pelo Vite e copiada para dentro do APK.
- Sem `server.url`: o app carrega os arquivos localmente (100% offline).

Sincronizar após qualquer alteração no frontend:

```bash
npm run cap:sync      # build + cap sync android
npm run cap:copy      # apenas copia os assets
npm run cap:open      # abre o projeto no Android Studio
```

---

## Abrir e compilar no Android Studio

1. `npm run cap:sync`
2. Abra a pasta `android/` no Android Studio (Open → selecione `android`).
3. Aguarde o *Gradle sync*. O projeto usa o Kotlin Gradle Plugin 2.2.20, fixado em
   [`android/build.gradle`](android/build.gradle) (bloco `buildscript`) — o mesmo
   padrão dos plugins oficiais @capacitor/camera e @capacitor/filesystem 8.x.
4. Selecione o módulo `app` e execute em um dispositivo/emulador.

### APK de debug pela linha de comando

```bash
npm run cap:sync
cd android
./gradlew assembleDebug      # macOS/Linux
gradlew.bat assembleDebug    # Windows (CMD/PowerShell)
```

O APK é gerado em `android/app/build/outputs/apk/debug/app-debug.apk`.
No Windows também existe o atalho `npm run android:debug`.

> Para compilar é obrigatório um **JDK 21** disponível (`JAVA_HOME`) e o Android SDK
> (`ANDROID_HOME`/`local.properties`). Sem eles o Gradle falha com
> `JAVA_HOME is not set`.

---

## Estrutura do projeto

```
.
├── capacitor.config.ts          # configuração do Capacitor (appId, webDir, plugins)
├── docs/
│   ├── architecture.md          # módulos e fluxo de dados
│   └── manual-testing.md        # roteiro de testes manuais em dispositivo Android
├── index.html
├── src/
│   ├── app/AppShell.tsx         # casca com navegação inferior
│   ├── App.tsx                  # rotas (HashRouter)
│   ├── config/                  # constantes centralizadas (app, editor, storage, WhatsApp)
│   ├── domain/
│   │   ├── editor/              # elementos, histórico, camadas, geometria, máscara, desenho
│   │   ├── project.ts           # documento do projeto de edição
│   │   ├── stickerPack.ts       # domínio do pacote de figurinhas
│   │   └── validation/          # regras oficiais do WhatsApp (funções puras)
│   ├── features/
│   │   ├── editor/              # página do editor + componentes + store + ações
│   │   ├── home/                # tela inicial
│   │   ├── packs/               # lista, detalhe e diálogo de pacotes
│   │   └── settings/            # ajustes, privacidade e créditos
│   ├── services/
│   │   ├── imaging/             # decodificação, rasterização, render, exportação WebP
│   │   ├── native/              # seletor de imagens e compartilhamento
│   │   ├── packs/               # gerenciamento de pacotes
│   │   ├── storage/             # gateway de arquivos, repositórios e JSON
│   │   ├── logging/             # logger leve
│   │   └── whatsapp/            # contents.json, exportador, serviço e ponte nativa
│   ├── shared/                  # componentes de UI reutilizáveis, erros e utilitários
│   ├── state/                   # stores de biblioteca, configurações e avisos
│   ├── styles/index.css         # sistema de design (tokens, tema, animações)
│   └── types/env.d.ts
└── android/                     # projeto Android gerado pelo Capacitor (versionado)
    ├── app/build.gradle         # plugin Kotlin + dependências
    └── app/src/main/
        ├── AndroidManifest.xml  # ContentProvider + queries de visibilidade
        ├── java/com/shappire/stickers/
        │   ├── MainActivity.java           # registra o plugin nativo
        │   ├── StickerPackPlugin.kt        # ponte React ⇄ Kotlin
        │   ├── StickerContentProvider.kt   # provider lido pelo WhatsApp
        │   └── StickerContents.kt          # leitura do contents.json
        └── res/xml/file_paths.xml          # FileProvider (compartilhamento)
```

---

## Explicação da integração com o WhatsApp

A integração segue a documentação pública <https://github.com/WhatsApp/stickers>.
O fluxo é:

1. **Exportação** — o editor gera WebP 512 × 512 (≤ 100 KB) e o ícone 96 × 96 (≤ 50 KB) em
   `files/sticker_packs/<identifier>/`. Em seguida o app reescreve
   `files/sticker_packs/contents.json` com todos os pacotes (`image_data_version`,
   emojis, texto de acessibilidade, `animated_sticker_pack` etc.).
2. **ContentProvider** — o WhatsApp consulta
   `content://com.shappire.stickers.stickercontentprovider/...`:
   - `/metadata` e `/metadata/<identifier>` → metadados do pacote;
   - `/stickers/<identifier>` → lista de figurinhas;
   - `/stickers_asset/<identifier>/<arquivo>` → bytes da imagem.
   A authority, as colunas do cursor e os paths seguem literalmente o exemplo oficial;
   apenas a origem dos arquivos muda (`files/` em vez de `assets/`).
3. **Adicionar ao WhatsApp** — o app dispara o Intent
   `com.whatsapp.intent.action.ENABLE_STICKER_PACK` com `sticker_pack_id`,
   `sticker_pack_authority` e `sticker_pack_name`. O WhatsApp abre o diálogo de
   confirmação e devolve o resultado:
   - `RESULT_OK` → pacote adicionado;
   - `RESULT_CANCELED` → cancelado pelo usuário ou erro em `validation_error`;
   - outros códigos → falha reportada com o código.
4. **Whitelist** — para saber se um pacote já foi adicionado, consultamos
   `content://<whatsapp>.provider.sticker_whitelist_check/is_whitelisted?authority=…&identifier=…`
   (mesma consulta da classe `WhitelistCheck` oficial). Se o WhatsApp for antigo e não
   expuser o provider, o resultado é `null` ("não foi possível verificar") e a interface
   não afirma nada.

Requisitos declarados no `AndroidManifest.xml`:

- provider próprio com `android:exported="true"` e
  `android:readPermission="com.whatsapp.sticker.READ"`;
- bloco `<queries>` para `com.whatsapp` e `com.whatsapp.w4b` (visibilidade de pacotes no
  Android 11+), sem o qual a checagem de instalação e a consulta à whitelist falham.

---

## Limitações conhecidas

- **A integração nativa compila, mas ainda não foi executada em dispositivo real.**
  O módulo Kotlin foi compilado com sucesso pelo Gradle Wrapper (JDK 21 + AGP 8.13.0 +
  Kotlin 2.2.20, versão fixada em [`android/build.gradle`](android/build.gradle)) e o
  `assembleDebug` gera o APK, porém o comportamento com o WhatsApp real (whitelist,
  importação de pacotes) **precisa ser validado em um dispositivo**.
- **Sem remoção de fundo por IA.** Existe apenas o recorte manual (apagar/restaurar com o
  dedo) e uma abstração preparada para plugar um segmentador no futuro.
- **Apenas figurinhas estáticas.** Pacotes animados (WebP animado) não são suportados nesta
  versão e são recusados pela validação.
- **Fontes:** são usadas apenas famílias presentes no Android (Roboto, Noto, monoespaçada e
  similares). Não há download de fontes, o que garante que a pré-visualização e a
  exportação sejam idênticas e que tudo funcione offline.
- **Texto em resolução de exportação:** o raster de texto é reamostrado se o usuário
  redimensionar muito o elemento; em tamanhos extremos pode haver leve borramento.
- **`avoid_cache`** é gravado, mas está **obsoleto**: desde o WhatsApp 2.25.9.78 a flag é
  ignorada pelo aplicativo.
- **Sem backend, contas, nuvem, marketplace ou compartilhamento público** — por escopo.
- Os arquivos ficam no armazenamento privado do app; desinstalar o aplicativo remove tudo.

---

## Como contribuir

1. Faça um fork e crie uma branch descritiva (`feat/recorte-automatico`).
2. Mantenha o padrão do projeto: TypeScript estrito (sem `any`), módulos com contratos
   explícitos, nenhuma lógica de negócio dentro de componentes de tela.
3. Rode `npm run check` e `npm run lint` antes de abrir o PR — ambos precisam passar.
4. Adicione testes para módulos de domínio, exportação, persistência, pacotes e validação.
5. Descreva no PR o que foi testado manualmente e em qual dispositivo/versão do Android.

---

## Licenças e créditos

Distribuído sob a licença **MIT**.

Bibliotecas principais: React, Vite, Tailwind CSS, Zustand, Konva + React-Konva, Capacitor,
Lucide Icons (veja a lista com as licenças dentro do app: *Ajustes → Créditos e licenças*).

O contrato de integração com o WhatsApp (ContentProvider, `contents.json`, Intent e
whitelist) foi implementado a partir do projeto oficial
[WhatsApp/stickers](https://github.com/WhatsApp/stickers), licenciado sob BSD-style.
"WhatsApp" é marca da Meta Platforms, Inc.; este aplicativo não é afiliado ao WhatsApp.
