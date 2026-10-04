# Shappire Stickers

**Shappire Stickers** is an offline-first Android application for creating, editing, and managing custom WhatsApp sticker packs.

Built with React, TypeScript, Capacitor, and native Android components, it provides a complete sticker creation workflow with a powerful editor, local storage, and native WhatsApp integration.

> **Project Status:** `v0.1.0` — First functional release. Core editing, local persistence, sticker pack management, and WebP export are implemented and tested. Native WhatsApp integration has been compiled but still requires validation on a physical Android device.

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

* No backend or external services.
* No accounts, authentication, or cloud synchronization.
* No telemetry or external tracking.
* All projects and generated stickers are stored locally.
* No internet connection required during normal application usage.

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

## Requirements

* Node.js 20 or later
* npm 10 or later
* JDK 21
* Android Studio (Ladybug or newer)
* Android SDK 36
* Android Gradle Plugin 8.13.0

Internet access is required for installing dependencies and downloading Gradle components. The application itself is designed to work offline.

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/vassilievz/shappire-stickers.git
cd shappire-stickers
npm install
```

### Development

Start the local development server:

```bash
npm run dev
```

Build the production frontend:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

### Quality Checks

Run the available validation commands:

```bash
npm run typecheck
npm run lint
npm test
npm run check
```

The `check` command runs TypeScript validation, tests, and the production build.

## Android Build

Synchronize the web application with the native Android project:

```bash
npm run cap:sync
```

Open the Android project:

```bash
npm run cap:open
```

To generate a debug APK on Windows:

```bash
npm run android:debug
```

Alternatively, build directly using Gradle:

```bash
cd android
gradlew.bat assembleDebug
```

On macOS or Linux:

```bash
./gradlew assembleDebug
```

The generated APK is located at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Ensure that `JAVA_HOME` and the Android SDK environment are correctly configured before building.

## Project Structure

```text
.
├── android/                 # Native Android project
├── docs/                    # Architecture and testing documentation
├── src/
│   ├── app/                 # Application shell and navigation
│   ├── config/              # Centralized application configuration
│   ├── domain/               # Core domain models and validation
│   ├── features/
│   │   ├── editor/           # Sticker editor
│   │   ├── home/             # Home screen
│   │   ├── packs/             # Sticker pack management
│   │   └── settings/          # Settings and licenses
│   ├── services/
│   │   ├── imaging/          # Image processing and export
│   │   ├── native/           # Native Android bridges
│   │   ├── packs/             # Pack operations
│   │   ├── storage/           # Local persistence
│   │   └── whatsapp/          # WhatsApp integration
│   ├── shared/                # Reusable components and utilities
│   ├── state/                 # Application state
│   ├── styles/                # Design tokens and global styles
│   └── types/                 # Type declarations
├── capacitor.config.ts
├── package.json
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
