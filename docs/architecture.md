# Arquitetura — Shappire Stickers

Documento resumido dos módulos e do fluxo de dados. O objetivo da organização é manter
o domínio (regras) independente da interface e do Android, para permitir evoluir o
aplicativo (por exemplo, adicionar um backend ou um segmentador de fundo por IA) sem
reescrever o núcleo.

## Princípios

1. **Domínio puro primeiro.** Regras de pacote, validação do WhatsApp, histórico, camadas,
   geometria e máscara são funções puras, sem React, canvas ou plugins nativos.
2. **Um único sentido de dependência.** `UI → store → services → domain/config`.
   O domínio nunca importa de `features/`.
3. **Contratos explícitos.** Toda fronteira entre camadas é uma interface TypeScript
   (`FileSystemGateway`, `ImageEncoder`, `RasterResources`, `StickerPackPlugin`).
4. **Sem `any`.** Configuração TypeScript estrita, incluindo `noUncheckedIndexedAccess`.
5. **Constantes centralizadas** em `src/config/`, nunca espalhadas pelo código.

## Camadas e módulos

### `src/config/`

- `whatsapp.ts` — requisitos oficiais (dimensões, limites de bytes, padrão de metadados,
  content types, chaves do Intent, authority). Fonte: documentação oficial.
- `editor.ts` — tamanho do canvas, limite do histórico, zoom, pincéis, fontes, cores.
- `storage.ts` — estrutura de diretórios (`library/`, `projects/`, `sticker_packs/`).
- `app.ts` — identidade, versão e limites do aplicativo.

### `src/domain/`

- `editor/elements.ts` — modelo dos elementos (`image`, `text`, `drawing`) e fábricas.
- `editor/history.ts` — pilha genérica de desfazer/refazer com limite.
- `editor/layers.ts` — ordenação, visibilidade, trava e duplicação.
- `editor/geometry.ts` — encaixe, centralização, rotação, hit-test e clamping.
- `editor/mask.ts` — máscara de recorte (traços normalizados, restauração por caminho).
- `editor/drawing.ts` — traços de desenho livre e revisão para cache.
- `stickerPack.ts` — pacote, figurinha, `image_data_version` e hash de conteúdo.
- `project.ts` — documento do projeto (canvas + elementos serializáveis).
- `validation/whatsappRules.ts` — validação completa do pacote (erros e avisos).

### `src/services/`

- `imaging/` — pipeline de imagem:
  `imageLoader` (decodifica/reduz) → `rasterCache` (raster LRU de imagem/texto/desenho) →
  `renderer` (desenha as camadas sem fundo) → `exportSticker` (WebP com qualidade
  decrescente) / `encoder` (codificação real via canvas).
- `storage/` — `fileSystemGateway` (contrato + implementação Capacitor),
  `memoryFileSystem` (testes), `jsonStore`, `packRepository`, `projectRepository`,
  `settingsRepository`, `storageStats` (medição e limpeza de armazenamento), `paths`.
- `projects/projectService.ts` — arquivar/restaurar e exclusão segura de projetos
  (limpa referências em pacotes antes de apagar; nunca remove pacotes exportados).
- `diagnostics/perf.ts` — medição local das etapas críticas (ativa apenas quando o
  diagnóstico de desempenho está ligado; sem telemetria externa).
- `packs/packService.ts` — casos de uso de pacote, sempre sincronizando o `contents.json`.
- `whatsapp/` — `contentsFile` (formato oficial), `stickerPackExporter` (arquivos),
  `whatsappService` (casos de uso) e `whatsappNative`/`stickerPackWeb` (ponte Capacitor).
- `native/` — `imagePicker` (galeria) e `shareService` (compartilhar).

### `src/state/`

- `libraryStore.ts` — pacotes, projetos (recentes + arquivados) e miniaturas em cache.
- `settingsStore.ts` — preferências persistidas + aplicação do tema.
- `toastStore.ts` — avisos globais (usável fora do React).
- `features/editor/store/editorStore.ts` — estado do editor (histórico, seleção,
  ferramenta, viewport). Os **canvas em memória ficam fora** do estado global
  (`AssetImageStore`/`EditorRasterCache`) para não misturar recursos gráficos com estado.

### `src/features/`

Páginas e componentes. Nenhuma regra de negócio: elas orquestram stores e serviços e
renderizam. O editor é dividido em `EditorPage` (composição), `EditorCanvas` (Konva),
`EditorHeader`, `EditorToolbar`, `EditorLayersPanel`, `EditorPropertiesPanel` e
`EditorExportSheet`.

### `android/`

- `StickerPackPlugin.kt` — plugin Capacitor: status, validação nativa, refresh,
  Intent oficial, whitelist e Play Store.
- `StickerContentProvider.kt` — provider lido pelo WhatsApp (contrato oficial).
- `StickerContents.kt` — leitura do `contents.json` (compartilhada pelos dois).
- `MainActivity.java` — registra o plugin.
- `AndroidManifest.xml` — provider, permissão de leitura e `<queries>`.

## Fluxo de dados

### 1. Criar uma figurinha

```
HomePage ──openNewProject()──▶ editorStore
EditorPage ──importImagesToCanvas()──▶ imagePicker (@capacitor/camera)
    └─ decodeImageFromDataUrl (reduz p/ caber na memória)
    └─ writeProjectAsset() ─▶ FileSystemGateway ─▶ files/projects/<id>/assets/*
    └─ AssetImageStore.set(assetPath, canvas)   ← canvas fora do estado global
    └─ editorStore.addImage() ─▶ history.push(elementos)
EditorCanvas ◀── history.present ── desenha via EditorRasterCache
```

### 2. Editar

```
Interação (Konva/swipe/painel)
    ├─ commit(mutation)      → nova entrada no histórico (desfazer/refazer)
    └─ transient(mutation)   → atualiza sem histórico (arraste/edição ao vivo)
EditorRasterCache invalida por chave (revisão da máscara, do texto ou do desenho)
```

### 3. Salvar

```
saveCurrentProject()
    ├─ renderStickerThumbnailDataUrl()  → miniatura WebP pequena
    └─ saveProject() ─▶ files/projects/<id>/project.json + índice library/projects.json
```

O resumo do índice carrega o campo aditivo `hidden`: ocultar apenas marca o projeto
como arquivado (arquivos intactos); excluir definitivamente apaga `projects/<id>` e
limpa as referências `projectId` das figurinhas que o usavam.

### 4. Exportar e enviar

```
EditorExportSheet ──exportStickerToPack(packId)──▶
    exportStickerArtwork()  → canvas 512² transparente → WebP (qualidade ↓ até ≤100 KB)
        └─ addStickerToPack() ─▶ files/sticker_packs/<id>/sticker_0N.webp
             └─ writeWhatsAppContents() ─▶ files/sticker_packs/contents.json
PackDetailPage ──addPackToWhatsApp()──▶
    whatsappService  ─────────────▶ StickerPackPlugin.kt (Kotlin)
        ├─ notifyChange() no provider
        ├─ Intent ENABLE_STICKER_PACK
        └─ resultado → outcome (added | cancelled | failed | unavailable)
WhatsApp lê content://<appId>.stickercontentprovider/... ◀── StickerContentProvider.kt
```

## Tratamento de erros

- Toda a camada de serviço lança `AppError` com um **código estável** (`src/shared/errors.ts`).
- `friendlyMessage()` converte o código em texto pt-BR; a interface nunca mostra stack trace.
- JSON corrompido não derruba o app: `readJson` sinaliza `corrupted` e a camada superior
  recomeça com base vazia.
- Operações canceladas pelo usuário (`CANCELLED`) não geram aviso de erro.

## Desempenho

- Canvas de trabalho já em 512 unidades: exportação 1:1, sem reamostragem.
- Rasters derivados em cache **LRU** (limite de entradas) com `disposeCanvas` ao sair.
- Imagens importadas reduzidas a no máximo 1600 px de lado antes de ir para o disco.
- Processamento de imagem assíncrono (`toBlob`) para reduzir pico de memória.
- Estado global guarda apenas dados serializáveis; imagens ficam em stores dedicadas.

## Pontos de extensão preparados (sem implementação prematura)

- `FileSystemGateway` → trocar por SQLite/IndexedDB sem tocar nos repositórios.
- `ImageEncoder` / `CanvasFactory` → injetar codificador ou canvas nativos (testes).
- `RasterResources` → substituir o cache por renderização por hardware.
- `packService` / `whatsappService` → ganchos para sincronização em nuvem e marketplace.
- `mask` → o recorte manual já produz máscaras normalizadas, formato que um segmentador
  automático (IA) pode alimentar diretamente.
