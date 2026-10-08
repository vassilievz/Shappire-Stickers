# Shappire Stickers

**Shappire Stickers** is an offline-first Android application for creating, editing, and managing custom WhatsApp sticker packs.

Built with React, TypeScript, Capacitor, and native Android components, it provides a complete sticker creation workflow — a powerful editor, local storage, and native WhatsApp integration — without requiring an account or an internet connection.

> **No login required.** Creating, editing, exporting, and installing sticker packs works 100% offline. The app needs no account, no Google login, no backend connection, and no internet access for its core functionality.

The optional profile system (display name, username, bio, avatar, banner) is a separate, non-essential feature for users who want a Shappire profile. Sticker creation never depends on it.

> **Project Status:** `v0.2.1` — npm-workspaces monorepo (`apps/app`, `apps/api`, `packages/contracts`). The Android application is fully offline-first; the optional profile backend is intentionally kept private and is not required to build or use the app.

## Table of Contents

- [Architecture](#architecture)
- [Authentication](#authentication)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Android Build](#android-build)
- [Project Structure](#project-structure)
- [WhatsApp Integration](#whatsapp-integration)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

## Architecture

Shappire Stickers is organized as an npm-workspaces monorepo:

```text
packages/contracts        Shared limits, routes and error codes (single source of truth)
apps/app                  React + Capacitor Android app (offline-first)
apps/api                  Optional profile backend (kept private)
```

### Optional Profile Backend

The optional profile backend lives in `apps/api`, but it is **intentionally not made publicly available in this repository**. It is not required by the core application and is responsible only for a small set of optional account/profile services. Keeping it private allows the public repository to remain focused on the offline-first Android application, without exposing infrastructure that is not required to build or use it.

Its responsibilities are limited to:

- Storage of basic optional profile information — display name, username, bio, avatar, and banner.
- Image metadata for profile pictures.
- V0X integration for hosting profile images.
- Optional Firebase Authentication for account/profile usage.

The backend does **not** store sticker projects, sticker packs, edited stickers, edit files, editor data, or any other core application content. All sticker content remains exclusively on the device.

```text
apps/app (Android) ── Firebase ID token ──> apps/api (optional)
                                             ├── MongoDB (profile + image metadata)
                                             └── V0X (profile images → public CDN URL)
```

- The app communicates with the Shappire API (`VITE_API_URL`) only for optional profile actions, authenticating with a Firebase ID token. It never sees the V0X key, MongoDB credentials, or Firebase Admin credentials — those live only on the backend.
- `packages/contracts` keeps username rules, image limits, routes, and error codes in sync between app and API.
- Sticker creation, editing, and export remain fully offline. Only optional profile actions require connectivity.

## Authentication

| Scope | Authentication |
| ----- | -------------- |
| Core application | 100% offline — no mandatory login |
| Optional profile services | Firebase Authentication (Google Login) + Shappire API |

The core sticker workflow — creation, editing, export, and pack installation — never depends on authentication, connectivity, or the backend.

## Features

### Sticker Editor

- Import images from your Android gallery.
- Edit stickers using a 512 × 512 canvas.
- Move, resize, rotate, duplicate, lock, and hide elements.
- Add customizable text with multiple font families, colors, outlines, shadows, and alignment options.
- Draw freely using a brush and eraser.
- Manually remove and restore image areas using a masking tool.
- Apply configurable outlines around sticker silhouettes.
- Manage layers with reordering, visibility, locking, and deletion.
- Undo and redo editing operations with a configurable history limit.
- Automatically save projects locally.

### Export

- Export stickers as actual WebP images with transparency.
- Optimize image quality to meet WhatsApp's 100 KB sticker size limit.
- Generate 96 × 96 PNG tray icons.
- Validate sticker dimensions, file formats, and size constraints.
- Share individual stickers using the native Android sharing system.

### Sticker Pack Management

- Create, rename, open, and delete sticker packs.
- Add, remove, and reorder stickers.
- Configure emojis and accessibility descriptions.
- Automatically generate pack icons or select a custom icon.
- Validate packs against WhatsApp's official requirements before export.
- Maintain consistent pack metadata and image versioning.

### Native Android Integration

- Custom Capacitor plugin written in Kotlin.
- Native `ContentProvider` for serving sticker metadata and image assets to WhatsApp.
- Official WhatsApp sticker pack installation intent.
- Support for checking WhatsApp and WhatsApp Business installation.
- Sticker pack whitelist verification.
- Native file validation, including WebP headers, dimensions, and file sizes.

### User Interface

- Refined dark interface with a monochromatic visual system.
- Optional light theme.
- Responsive, mobile-first layout.
- Subtle animations and accessible touch targets.
- Lucide icons and consistent design tokens.
- Fully localized interface in Brazilian Portuguese, with additional translations for English, Spanish, German, Italian, and Hindi.

### Over-the-Air Updates

- Optional over-the-air updates via OtaKit (`@otakit/capacitor-updater`), when configured.

### Privacy and Offline Support

- Sticker creation and editing never depend on a server.
- Sticker projects and packs are stored on the device; nothing is uploaded.
- Export works offline.
- WhatsApp integration works without the backend.
- No sticker ever needs to be uploaded.
- The optional backend stores only minimal profile data.
- Profile images may be hosted externally via V0X when the profile system is used.
- No cloud-storage dependency for sticker projects.
- No login is required for the main application.

## Technology Stack

### Core Application

| Component | Technology |
| --------- | ---------- |
| UI Framework | React 19 |
| Language | TypeScript (strict) |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 |
| State Management | Zustand 5 |
| Canvas / Editor | Konva 10, React-Konva 19 |
| Navigation | React Router 7 |
| Icons | Lucide React |
| Image Processing | Canvas API, WebP |

### Native (Android)

| Component | Technology |
| --------- | ---------- |
| Runtime | Capacitor 8 |
| Native Integration | Kotlin |
| Native Components | Custom Capacitor plugin, native ContentProvider |
| Build | Android Gradle Plugin 8.13.0, Android SDK 36 |

### Optional Profile Services

> These components are used only by the optional profile system and are not required to run the core application.

| Component | Technology |
| --------- | ---------- |
| API | Node.js 20+, Express 5 (JavaScript, ESM) |
| Database | MongoDB (Mongoose 8) |
| Authentication | Firebase Auth + Admin SDK |
| File Hosting | V0X API |

### Testing and Quality

| Tool | Purpose |
| ---- | ------- |
| Vitest 5 + Testing Library | Unit and component tests |
| TypeScript (`tsc --noEmit`) | Static type checking |
| ESLint | Code linting |

## Requirements

- Node.js 20 or later
- npm 10 or later
- JDK 21
- Android Studio (Ladybug or newer)
- Android SDK 36
- Android Gradle Plugin 8.13.0

Internet access is required for installing dependencies and downloading Gradle components. Sticker editing, export, and WhatsApp integration work fully offline; only optional profile actions require connectivity.

## Getting Started

### Installation

Clone the repository and install dependencies for the whole monorepo:

```bash
git clone https://github.com/vassilievz/shappire-stickers.git
cd shappire-stickers
npm install
```

### Development

Start the app dev server:

```bash
npm run app:dev
```

Build the production frontend:

```bash
npm run build
```

> Optional profile features (Google Login and profile editing) require a reachable Shappire API instance, configured through `VITE_API_URL` in `apps/app/.env`. The API is not part of the public distribution — every other feature works without it.

### Quality Checks

Run validation across all workspaces:

```bash
npm run typecheck
npm run lint
npm test
```

## Android Build

Synchronize the web application with the native Android project:

```bash
npm run cap:sync
```

To generate a debug APK on Windows:

```bash
npm run android:debug
```

Alternatively, build directly using Gradle:

```bash
cd apps/app/android
gradlew.bat assembleDebug
```

On macOS or Linux:

```bash
./gradlew assembleDebug
```

The generated APK is located at:

```text
apps/app/android/app/build/outputs/apk/debug/app-debug.apk
```

Ensure that `JAVA_HOME` and the Android SDK environment are correctly configured before building.

## Project Structure

```text
.
├── apps/
│   ├── app/                     # React + Capacitor Android app (offline-first)
│   │   ├── android/             # Native Android project
│   │   ├── capacitor.config.ts  # Capacitor configuration
│   │   └── src/
│   │       ├── app/             # Application shell and navigation
│   │       ├── config/          # Centralized application configuration
│   │       ├── domain/          # Core domain models and validation
│   │       ├── features/
│   │       │   ├── editor/      # Sticker editor
│   │       │   ├── home/        # Home screen
│   │       │   ├── packs/       # Sticker pack management
│   │       │   ├── profile/     # Profile editing (optional)
│   │       │   └── settings/    # Settings and licenses
│   │       ├── i18n/            # Localization (pt-BR, en, es, de, it, hi)
│   │       ├── services/
│   │       │   ├── api/         # Shappire API client (optional profile)
│   │       │   ├── firebase/    # Firebase Auth client (optional profile)
│   │       │   ├── imaging/     # Image processing and export
│   │       │   ├── native/      # Native Android bridges
│   │       │   ├── ota/         # OtaKit over-the-air updates
│   │       │   ├── packs/       # Pack operations
│   │       │   ├── profile/     # Profile orchestration (optional)
│   │       │   ├── storage/     # Local persistence
│   │       │   └── whatsapp/    # WhatsApp integration
│   │       ├── shared/          # Reusable components and utilities
│   │       ├── state/           # Application state (auth, profile, library)
│   │       └── styles/          # Design tokens and global styles
│   └── api/                     # Optional profile backend (kept private — not publicly distributed)
├── packages/
│   └── contracts/               # Shared limits, routes and error codes (app ↔ API)
├── package.json                 # npm workspaces root
└── README.md
```

## WhatsApp Integration

Shappire Stickers implements the public [WhatsApp Stickers repository](https://github.com/WhatsApp/stickers) integration model.

The integration consists of:

1. **Sticker generation:** Stickers are exported as WebP images and stored in the application's private storage.
2. **Metadata generation:** The application generates and maintains `contents.json`, including sticker pack metadata, image references, emojis, and accessibility descriptions.
3. **ContentProvider:** A native Android provider exposes the required metadata and sticker assets through the expected content URIs.
4. **Pack installation:** The application launches the official WhatsApp sticker pack installation intent.
5. **Installation verification:** The application checks the WhatsApp sticker whitelist when supported by the installed version.

The native implementation has been compiled successfully. Real-device validation remains necessary to confirm the complete installation workflow.

## Known Limitations

- Animated stickers and GIF-based editing are not supported in the current release.
- Background removal using AI is not available. Image editing currently relies on manual masking.
- Native WhatsApp integration still requires validation on a physical device.
- Only locally available fonts are used to maintain offline compatibility.
- Extremely small or heavily resized text elements may exhibit minor rendering quality loss.
- The `avoid_cache` field is retained for compatibility, although newer WhatsApp versions may ignore it.
- There is no cloud synchronization or public sticker marketplace. Profile features are optional and limited to basic profile data — sticker content is never stored on the backend.

## Contributing

Contributions are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes following the existing architecture and TypeScript conventions.
4. Add or update tests where appropriate.
5. Run the project checks and linting commands.
6. Submit a pull request with a clear description of the changes and testing performed.

Keep business logic within domain and service modules rather than embedding it directly in UI components.

## License

This project is distributed under the **MIT License**.

Shappire Stickers uses open-source libraries and tools, including React, Vite, Tailwind CSS, Zustand, Konva, Capacitor, and Lucide. Their respective licenses are available in the application under **Settings → Credits and Licenses**.

The WhatsApp sticker integration is based on the official [WhatsApp Stickers repository](https://github.com/WhatsApp/stickers), which uses a BSD-style license.

WhatsApp is a trademark of Meta Platforms, Inc. Shappire Stickers is an independent project and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta.
