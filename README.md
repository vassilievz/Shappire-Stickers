# Shappire Stickers

**Shappire Stickers** is an offline-first Android application for creating, editing, and managing custom WhatsApp sticker packs, backed by a custom profile API.

Built with React, TypeScript, Capacitor, and native Android components, it provides a complete sticker creation workflow with a powerful editor, local storage, and native WhatsApp integration. User profiles (display name, username, bio, avatar, banner) are managed by the Shappire API with MongoDB and V0X file hosting.

> **Project Status:** `v0.2.1` — npm-workspaces monorepo (`apps/app`, `apps/api`, `packages/contracts`), profile system served by a custom Express + MongoDB API, Firebase Auth (Google Login), and V0X image hosting.

## Monorepo Architecture

```text
packages/contracts        Shared limits, routes and error codes (single source of truth)
apps/app                  React + Capacitor Android app (offline-first)
apps/api                  Express API: MongoDB profiles + V0X image hosting
```

```text
apps/app (Android) ── Firebase ID token ──> apps/api
                                             ├── MongoDB (profile + image metadata)
                                             └── V0X (files → public CDN URL)
```

- The app talks only to the Shappire API (`VITE_API_URL`) with a Firebase ID token. It never sees the V0X key, MongoDB credentials, or Firebase Admin credentials — those live only in `apps/api/.env` (gitignored).
- `packages/contracts` keeps username rules, image limits, routes, and error codes in sync between app and API.
- Sticker creation, editing, and export remain fully offline. Only profile actions require connectivity.

See `apps/api/README.md` for API setup (`.env.example`, endpoints, tests).

## Features

### Sticker Editor

* Import images from your Android gallery.
* Edit stickers using a 512 × 512 canvas.
* Move, resize, rotate, duplicate, lock, and hide elements.
* Add customizable text with multiple font families, colors, outlines, shadows, and alignment options.
* Draw freely using a brush and eraser.
* Manually remove and restore image areas using a masking tool.
* Apply configurable outlines around sticker silhouettes.
* Manage layers with reordering, visibility, locking, and deletion.
* Undo and redo editing operations with a configurable history limit.
* Automatically save projects locally.

### Export

* Export stickers as actual WebP images with transparency.
* Optimize image quality to meet WhatsApp's 100 KB sticker size limit.
* Generate 96 × 96 PNG tray icons.
* Validate sticker dimensions, file formats, and size constraints.
* Share individual stickers using the native Android sharing system.

### Sticker Pack Management

* Create, rename, open, and delete sticker packs.
* Add, remove, and reorder stickers.
* Configure emojis and accessibility descriptions.
* Automatically generate pack icons or select a custom icon.
* Validate packs against WhatsApp's official requirements before export.
* Maintain consistent pack metadata and image versioning.

### Native Android Integration

* Custom Capacitor plugin written in Kotlin.
* Native `ContentProvider` for serving sticker metadata and image assets to WhatsApp.
* Official WhatsApp sticker pack installation intent.
* Support for checking WhatsApp and WhatsApp Business installation.
* Sticker pack whitelist verification.
* Native file validation, including WebP headers, dimensions, and file sizes.

### User Interface

* Refined dark interface with a monochromatic visual system.
* Optional light theme.
* Responsive, mobile-first layout.
* Subtle animations and accessible touch targets.
* Lucide icons and consistent design tokens.
* Fully localized Brazilian Portuguese interface.

### Privacy and Offline Support

* Sticker creation, editing, and export work fully offline; projects and stickers are stored locally.
* Online services are used only for the user profile (Google Login via Firebase Auth, profile data via the Shappire API).
* Profile images are hosted on V0X; the database stores only metadata — no image binaries.
* Offline profile edits are blocked with a clear message; the last known profile is cached locally.
* No telemetry or external tracking.

## Technology Stack

| Component          | Technology                |
| ------------------ | ------------------------- |
| Frontend           | React 19                  |
| Language           | TypeScript (Strict)       |
| Build Tool         | Vite 8                    |
| Styling            | Tailwind CSS 4            |
| State Management   | Zustand 5                 |
| Canvas             | Konva 10, React-Konva 19  |
| Android Runtime    | Capacitor 8               |
| Native Integration | Kotlin                    |
| Image Processing   | Canvas API, WebP          |
| Icons              | Lucide React              |
| Testing            | Vitest 5, Testing Library |
| Navigation         | React Router              |
| API                | Node.js 20+, Express 5, JavaScript (ESM) |
| Database           | MongoDB (Mongoose 8)      |
| Auth               | Firebase Auth + Admin SDK |
| File Hosting       | V0X API                   |

## Requirements

* Node.js 20 or later
* npm 10 or later
* JDK 21
* Android Studio (Ladybug or newer)
* Android SDK 36
* Android Gradle Plugin 8.13.0

To run the API locally: a MongoDB database (Atlas or local), a Firebase service account (Admin SDK), and a V0X API key. See `apps/api/README.md`.

Internet access is required for installing dependencies and downloading Gradle components. Sticker editing works offline; profile actions require connectivity.

## Getting Started

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

Start the API (requires `apps/api/.env` — see `apps/api/README.md`):

```bash
npm run dev -w apps/api
```

Build the production frontend:

```bash
npm run build
```

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
│   ├── app/                     # React + Capacitor Android app
│   │   ├── android/             # Native Android project
│   │   └── src/
│   │       ├── app/             # Application shell and navigation
│   │       ├── config/          # Centralized application configuration
│   │       ├── domain/          # Core domain models and validation
│   │       ├── features/
│   │       │   ├── editor/      # Sticker editor
│   │       │   ├── home/        # Home screen
│   │       │   ├── packs/       # Sticker pack management
│   │       │   ├── profile/     # Profile editing
│   │       │   └── settings/    # Settings and licenses
│   │       ├── services/
│   │       │   ├── api/         # Shappire API HTTP client (profile)
│   │       │   ├── firebase/    # Firebase Auth + Analytics (client)
│   │       │   ├── imaging/     # Image processing and export
│   │       │   ├── native/      # Native Android bridges
│   │       │   ├── ota/         # OtaKit updates
│   │       │   ├── packs/       # Pack operations
│   │       │   ├── profile/     # Profile orchestration (upload + save)
│   │       │   ├── storage/     # Local persistence
│   │       │   └── whatsapp/    # WhatsApp integration
│   │       ├── shared/          # Reusable components and utilities
│   │       ├── state/           # Application state (auth, profile, library)
│   │       ├── styles/          # Design tokens and global styles
│   │       └── i18n/            # Localization (pt-BR, en, es, de, it, hi)
│   └── api/                     # Express API (MongoDB + Firebase Admin + V0X)
│       └── src/
│           ├── config/          # env, MongoDB, Firebase Admin, V0X
│           ├── middleware/       # requireAuth, upload, rate limit, errors
│           ├── models/          # Mongoose User model
│           ├── routes/          # /health, /api/profile(+avatar/banner)
│           ├── services/        # userService, profileService, v0xService
│           └── utils/           # magic bytes, ApiError
├── packages/
│   └── contracts/               # Shared limits, routes, error codes (app ↔ API)
├── capacitor.config.ts
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

* Animated stickers and GIF-based editing are not supported in the current release.
* Background removal using AI is not available. Image editing currently relies on manual masking.
* Native WhatsApp integration still requires validation on a physical device.
* Only locally available fonts are used to maintain offline compatibility.
* Extremely small or heavily resized text elements may exhibit minor rendering quality loss.
* The `avoid_cache` field is retained for compatibility, although newer WhatsApp versions may ignore it.
* There is no cloud synchronization, public sticker marketplace, or account system.

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
