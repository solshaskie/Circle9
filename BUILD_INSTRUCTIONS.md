# Circle9 Build and Deployment Instructions

## Overview

Circle9 is a Windows-Linux file bridge application built with Tauri, Rust (backend), and TypeScript (frontend). This guide covers testing, troubleshooting, and building the application into a standalone executable.

## 🧪 Testing and Development

### Prerequisites for Development

1. **Node.js** - Version 16.x or higher
2. **npm** or **yarn** package manager
3. **Rust** - Version 1.60+ (for production builds)
4. **Visual Studio Build Tools** (Windows development)

### Step 1: Install Dependencies

```bash
cd circle9
npm install
```

### Step 2: Test in Development Mode

Start the development server to test Circle9:

```bash
npm run dev
```

**What happens:**
- Compiles TypeScript and SASS
- Starts local web server (typically http://localhost:8080)
- Opens Tauri development window
- Hot-reload enabled (changes update automatically)

**Expected behavior:**
- Five-pane layout should appear (Windows/Linux directories + terminal log)
- Connection panel should be visible in top-right
- Connected status when credentials are entered
- File transfer capabilities between directories

### Step 3: Test Key Features

#### Connection Panel Testing
1. **Enter credentials** in the persistent panel (top-right corner)
2. **Click "Test"** button to validate connection
3. **Verify "Connected" status** (green dot + connection info)
4. **Test auto-connect** on app restart

#### Terminal Pane Testing
1. **Transfer files** via drag-and-drop or controls
2. **Verify CLI commands appear** in terminal log
3. **Check color coding** (green=success, red=error)
4. **Test clear/toggle controls**

#### File Operations Testing
1. **Connect to Linux server** using connection panel
2. **Transfer files** between Windows/Linux panes
3. **Verify transfers work** and show in terminal log
4. **Test bidirectional transfers**

### Step 4: Troubleshoot Issues

#### Common Development Issues

**Issue: "npm run dev" fails**
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Issue: Connection panel not showing**
- Check browser console for JavaScript errors
- Verify `ConnectionPanel.ts` loaded correctly
- Check CSS conflicts in styles

**Issue: File transfers not working**
- Test SSH connection manually first
- Check credentials are saved correctly
- Verify Tauri backend commands work

**Issue: Terminal log not updating**
- Check event listeners in `FivePaneLayout.ts`
- Verify CLI command generation functions
- Test with browser dev tools

**Issue: Layout issues**
- Resize browser window
- Check CSS responsive breakpoints
- Verify pane ratios are sensible

## 🏗️ Production Build Process

### Prerequisites for Production Build

1. **Rust toolchain** (latest version recommended)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Tauri CLI** (should be included in devDependencies, but install globally for convenience)
   ```bash
   npm install -g @tauri-apps/cli
   ```

3. **Visual Studio Build Tools** for Windows native compilation
   - Download from Microsoft's website
   - Install "Desktop development with C++" workload

### Step 5: Build for Production

#### Option A: Full Build (Recommended)

```bash
# Build TypeScript, compile styles, bundle everything
npm run build

# This runs: tsc && sass compile && copy assets && tauri build
```

#### Option B: Tauri Build Only (if assets already compiled)

```bash
npm run build:tauri
```

### Step 6: Build Output

**Successful build creates these files in `src-tauri/target/release/bundle/`:**

```
bundle/
├── msi/                 # Windows MSI installer
│   └── Circle9_0.4.0_x64.msi
├── nsis/               # NSIS installer (alternative)
│   └── Circle9_0.4.0_x64-setup.exe
└── Circle9.exe         # Standalone executable
```

### Step 7: Test Built Executable

**Before distributing:**
1. **Install** the MSI or run standalone exe on a test Windows machine
2. **Verify** all features work (connection panel, terminal, file transfers)
3. **Test** on machines without Node.js/Rust installed
4. **Confirm** file paths and settings are preserved

## 📦 Distribution Options

### Method 1: MSI Installer (Recommended for Users)

**Pros:** Professional installation, adds to Add/Remove Programs
**Cons:** Requires admin privileges
**File:** `Circle9_0.4.0_x64.msi`

```bash
# User installation process:
# 1. Double-click MSI file
# 2. Run installer (admin privileges)
# 3. Find Circle9 in Start Menu after installation
```

### Method 2: Standalone Executable

**Pros:** No installation required, portable
**Cons:** No start menu integration, settings stored locally
**File:** `Circle9.exe`

```bash
# User usage process:
# 1. Place Circle9.exe wherever desired
# 2. Double-click to run
# 3. App creates settings in user AppData
```

### Method 3: NSIS Installer

**Pros:** Portable installer, optional admin requirements
**Cons:** Less common than MSI
**File:** `Circle9_0.4.0_x64-setup.exe`

## 🔧 Configuration

### Settings Storage Location

**Windows:** `%APPDATA%\com.circle9.app\`
- `credentials.json` - Saved Linux connection info
- `settings.json` - App preferences
- `logs.txt` - Application logs

### Checksums for Distribution

```bash
# Generate checksums for distribution verification
cd src-tauri/target/release/bundle/
sha256sum * > checksums.sha256
```

## 🐛 Debugging Built Application

### View Application Logs

1. **Enable verbose logging** in `src-tauri/src/main.rs`
2. **Check logs** in system log viewer (Event Viewer on Windows)
3. **Inspect settings** in AppData folder

### Common Production Issues

**Crash on startup:**
- Missing MSVC redistributables
- Corrupted user settings

**File operations fail:**
- Permission issues with SSH server
- Path format mismatches

**Connection panel issues:**
- Malformed credentials in storage
- Network connectivity problems

## 🚀 Final Checklist

### Before Release:
- [ ] All features tested in development mode
- [ ] Build completes without errors
- [ ] Executable tested on clean Windows 10/11 machine
- [ ] File operations work correctly
- [ ] Connection panel saves/loads credentials
- [ ] Terminal log shows CLI commands
- [ ] No console errors in built application

### Distribution:
- [ ] MSI installer created and signed
- [ ] Checksum file generated
- [ ] Release notes include system requirements
- [ ] Test machines can install and run without issues

## 📋 System Requirements

**Minimum:**
- Windows 10 (64-bit)
- 4GB RAM
- 50MB disk space

**Recommended:**
- Windows 11
- 8GB RAM
- SSH/SFTP access to Linux servers

---

**After completing this checklist and testing, Circle9 will be ready for distribution as a professional Windows application! 🎉**
