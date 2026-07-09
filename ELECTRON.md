# Bharath Bank of India — Desktop App Setup

This directory contains the Electron desktop wrapper for the Bharath Bank web app. The app packages the same web frontend (in `public/`) into native Windows, macOS, and Linux installers.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs Electron and electron-builder along with the app's other dependencies.

### 2. Run the Desktop App (Development)

```bash
npm start
```

This launches Electron and opens the Bharath Bank app in a native desktop window. The app uses the same localStorage-backed authentication and data persistence as the web version.

### 3. Build Installers (Production)

```bash
npm run dist
```

On Windows, this builds a portable `.exe` installer in `dist/`.  
On macOS, it builds a `.dmg` installer.  
On Linux, it builds an `.AppImage`.

Electron-builder auto-detects your OS and builds the appropriate installer.

## Project Structure

```
Bharath Bank Netlify/
├── desktop/
│   └── main.js              ← Electron main process: creates window, loads app
├── public/
│   ├── index.html           ← App entry point
│   ├── dashboard.html       ← Dashboard page
│   ├── bank.js              ← Application logic (works in Electron & web)
│   └── style.css            ← Styles
├── package.json             ← Electron config + build settings
└── ELECTRON.md              ← This file
```

## How It Works

1. **`package.json`** specifies `"main": "desktop/main.js"` and build config for electron-builder.
2. **`desktop/main.js`** creates a BrowserWindow and loads `public/index.html` via the `file://` protocol.
3. The app uses localStorage for persistence (same as the web version).
4. **electron-builder** packages everything into platform-specific installers.

## Configuration

### Window Properties (desktop/main.js)

- **Dimensions**: 1180×820px (resizable, minimum 900×640)
- **Background**: Dark blue (#0b2447) to match the theme
- **Context Isolation**: Enabled for security
- **Menu**: Hidden (clean, app-like look)

### Build Output (package.json)

- **AppId**: `in.bharathbank.app`
- **Product Name**: Bharath Bank of India
- **Files Included**: `public/`, `desktop/`, `package.json`
- **Windows**: Portable `.exe` (no registry entries)

## Development Tips

### Reload the App
Press `Ctrl+R` in the desktop window to reload the web content without restarting Electron.

### Open DevTools
Press `F12` in the desktop window to open Chrome DevTools for debugging.

### Clear Local Data
In DevTools, go to **Application** > **Local Storage** and delete the relevant keys. The app stores:
- `users` — registered users
- `accounts` — account data
- `transactions` — transaction history

## Troubleshooting

### "electron: command not found"
Run `npm install` again to ensure Electron is installed.

### App won't start
- Check the console: `npm start` should print any errors.
- Ensure `public/index.html` exists and is valid.

### Build fails on Windows
- Install Visual C++ Build Tools if not already present.
- Run the command from PowerShell or CMD (not WSL).

### Installer is very large
Electron bundles Chromium (~100MB). This is normal. The portable `.exe` is self-contained.

## Cross-Platform Building

To build for other platforms on Windows:
- **Linux AppImage**: Requires cross-compilation tools (see electron-builder docs).
- **macOS**: Requires building on a Mac. Use GitHub Actions or a remote Mac for CI/CD.

For production releases, use CI/CD (GitHub Actions, Azure Pipelines, etc.) to build all platforms.

## Next Steps

1. Run `npm start` to verify the app launches.
2. Test login and core features in the desktop window.
3. Run `npm run dist` to build a production `.exe`.
4. Distribute the installer in `dist/` to users.

---

For more info on Electron, see https://www.electronjs.org/docs.  
For electron-builder, see https://www.electron.build/.
