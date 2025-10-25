# Circle9 - Windows-Linux File Bridge

<div align="center">

[![Windows Compatible](https://img.shields.io/badge/Windows-0078D4?style=flat&logo=windows&logoColor=white)](#)
[![Linux Compatible](https://img.shields.io/badge/Linux-FCC624?style=flat&logo=linux&logoColor=black)](#)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat&logo=rust&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](#)
[![Tauri](https://img.shields.io/badge/Tauri-FFC131?style=flat&logo=tauri&logoColor=black)](#)

[![Stars](https://img.shields.io/github/stars/solshaskie/Circle9?style=social)](https://github.com/solshaskie/Circle9)
[![Issues](https://img.shields.io/github/issues/solshaskie/Circle9)](https://github.com/solshaskie/Circle9/issues)
[![Discussions](https://img.shields.io/github/discussions/solshaskie/Circle9)](https://github.com/solshaskie/Circle9/discussions)
[![Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Bridging the Windows-Linux gap for developers who learn by doing**

[🚀 Download](#-installation) • [📖 Docs](#-features) • [🤝 Contributing](#-contributing) • [💡 Inspired by Frustration](#-the-problem)

<img src="https://raw.githubusercontent.com/solshaskie/Circle9/main/assets/screenshots/main-interface.png" alt="Circle9 Interface" width="800">

*The glass pane terminal shows CLI commands as you drag files*

</div>

---

## 🎯 **The Problem**

Are you a **Windows developer building cross-platform apps**? Do you get frustrated when:

❌ **Simple tasks break your flow**: "Why is copying a file to Linux so hard?"
❌ **Coding agents speak alien commands**: "`chmod +x deploy.sh` - what the heck does that mean?"
❌ **File operations disrupt development**: Stop what you're doing just to move a build file?
❌ **Windows + Linux = Constant context switching**: File Explorers on both sides, endless confusion

Circle9 was born from this frustration - when **Windows Explorer patterns met Linux reality** and created workflow chaos.

## ✅ **The Solution: Circle9**

**Circle9 is the first file manager that teaches you Linux while you work**:

🗂️ **Windows Explorer meets SFTP**: Intuitive drag-and-drop like you're used to
📱 **Always-visible credentials**: No hunting for connection details
🪟 **"Glass pane" terminal**: See CLI commands as you perform GUI actions
💪 **Cross-platform productivity**: Test your web app on Linux without breaking flow
🧠 **Learn by osmosis**: Watch bash commands while staying in your comfort zone

**Eliminate file operation frustration and discover your Linux fluency along the way.**

## 🚀 **Installation**

### Option 1: Standalone Executable (Easiest)

```bash
## Download and Run - Like Windows Explorer!

1. Download Circle9_0.4.0_x64.msi from [Releases](https://github.com/solshaskie/Circle9/releases)
2. Run the installer (admin rights needed)
3. Find Circle9 in your Start Menu
4. Double-click to launch! 🚀
```

**Requirements**: Windows 10/11, SSH server access

### Option 2: Development Setup

```bash
## For Contributors & Advanced Users

# Clone the repo
git clone https://github.com/solshaskie/Circle9
cd Circle9

# Install dependencies
npm install

# Run in development
npm run dev

# Build for production
npm run build
```

**Requirements**: Node.js 16+, Rust 1.60+, Visual Studio Build Tools

## 🌟 **Key Features**

### 🔐 **Persistent Credential Management**
- **Always-visible panel** - No modal popups interrupting your workflow
- **One-click testing** - Verify SSH connections instantly
- **Secure storage** - Credentials persist across sessions
- **Auto-reconnect** - Loads saved connections on startup

### 🪟 **"Glass Pane" Terminal** *The secret sauce*
Every GUI action shows its CLI equivalent - you're learning Linux while you work!

```bash
🔗 Drag one file: scp -p "app.exe" user@server:/var/www/app.exe
🔗 Copy directory: rsync -avz --exclude='.git' ./ user@server:~/backup/
🔗 Set permissions: chmod 755 /home/user/scripts/deploy.sh
```

### 🎨 **Five-Pane Interface**
```
┌─────────────────┬─────────────────┐  🪟 Windows Directory + Files
│ Directory Tree  │ File List       │
├─────────────────┴─────────────────┤  🔄 Resizable panes
├─────────────────┬─────────────────┤  🐧 Linux Directory + Files
│ Directory Tree  │ File List       │
├─────────────────┴─────────────────┤  💻 Terminal learning pane
│ circle9$ scp -p file.txt ...        │
└───────────────────────────────────┘
```

### ⚡ **Efficiency Features**
- **Bidirectional transfers**: Windows ↔ Linux seamlessly
- **Drag-and-drop**: Windows Explorer intuitive
- **Resume transfers**: Automatic handling of interruptions
- **Permission mapping**: Windows ACL ↔ Linux chmod
- **Case sensitivity**: Smart conflict resolution

## 📖 **Quick Start**

1. **Launch Circle9** (double-click `Circle9.exe`)

2. **Set Linux connection** (persistent panel, top-right):
   ```
   IP/Host: 192.168.1.100
   Username: your-username
   Password: *********
   ```

3. **Click "Test" → "Connected! ✅"**

4. **Start transferring**: Drag files between Windows/Linux panes

5. **Watch learning happen**: Terminal window shows `scp -p file.txt user@linux:~/`

**That's it! Work like you do in Windows Explorer, but now it talks to Linux too.**

## 🎓 **The Learning Experience**

### **Before Circle9:**
- `chmod +x script.sh` - *mysterious voodoo command*
- `C:\folder\` vs `/home/user/folder/` - *path confusion*
- `rsync vs scp` - *no idea which to use*

### **After Circle9:**
- See `chmod +x script.sh` when setting executable permissions
- Path translation happens automatically in file operations
- Learn `rsync` strengths by watching its usage

**❓ "Tailored for Windows users who want to build cross-platform apps without becoming Linux masters"**

## 🏗️ **How It Works**

Circle9 bridges two worlds:

- **Frontend**: TypeScript/React + Tauri for native Windows experience
- **Backend**: Rust SSH/SFTP client for reliable Linux communication
- **Translation Layer**: GUI actions generate CLI command logs
- **State Management**: Persistent connections with secure credential storage

### **Architecture**
```
┌─────────────────────────────────────┐
│         Circle9 UI (Tauri)          │ ← Windows Explorer UX
│ ┌─────────────────┬─────────────────┐ │
│ │ Windows 🌐     │ Linux 🐧       │ │ ← Cross-platform bridge
│ │ Explorer       │ Server         │ │
│ └─────────────────┴─────────────────┘ │
│ 🔗 circle9$ scp -p file.txt ...       │ ← Learning Terminal
│                                     │ ← Translates GUI to CLI
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│       Rust SSH/SFPT Backend        │ ← SSH connection handling
│                                     │ ← File operation execution
│ Tauri APIs:                        │ ← Windows-Linux bridging
│ • connect_ssh()                    │
│  • list_linux_dir()                 │
│  • copy_to_linux()                  │
│  • log_cli_command()                │
└─────────────────────────────────────┘
```

## 🧪 **Testing**

```bash
# Run development version
npm run dev

# Run TypeScript checks
npm run compile

# Run tests (when available)
npm test
```

## 📦 **Build Instructions**

See [`BUILD_INSTRUCTIONS.md`](BUILD_INSTRUCTIONS.md) for complete build, test, and deployment guide.

### **Build Artifacts**
- `Circle9.exe` - Standalone portable executable
- `Circle9_0.4.0_x64.msi` - Windows installer
- `Circle9_0.4.0_x64-setup.exe` - Alternative installer

## 🤝 **Contributing**

**Found Circle9 helpful? Want to improve it?**

### **Ways to Contribute**
- 🐛 **Bug Reports**: [Issues](https://github.com/solshaskie/Circle9/issues)
- 💡 **Feature Requests**: Especially UX/UI improvements for Windows users
- 🔧 **Code Contributions**: See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- 📖 **Documentation**: Help clarify the Windows-Linux learning experience

### **Development Setup**
```bash
git clone https://github.com/solshaskie/Circle9
cd Circle9
npm install
npm run dev  # Hot reload development
```

### **Target Audience Input Welcome**
Are you a Windows developer struggling with Linux deployment? Your perspective is invaluable for making Crossplatform development more accessible.

## 🆘 **Need Help?**

Got questions or feedback? Here's where the Circle9 community hangs out:

### **Community Support**
- 💬 [**GitHub Discussions**](https://github.com/solshaskie/Circle9/discussions) - Ask questions, share tips, discuss features
- 🐛 [**GitHub Issues**](https://github.com/solshaskie/Circle9/issues) - Report bugs or request features
- 📧 **Email Support** - sol@your-domain.com (for direct developer support)

### **Quick Help Topics**
- [SSH Setup Guide](BUILD_INSTRUCTIONS.md#ssh-setup)
- [Troubleshooting](BUILD_INSTRUCTIONS.md#troubleshooting)
- [Cross-Platform Development Tips](#cross-platform-development-tips)
- [Learning Linux Commands](#the-learning-experience)

**🎓 Share your Windows-to-Linux journey!** Your experiences help make Circle9 better for the next developer.

## 📋 **Roadmap**

### **Phase 1: Core Functionality** ✅
- [x] Basic file transfer Windows ↔ Linux
- [x] Persistent credential management
- [x] SSH connection handling
- [x] CLI command logging

### **Phase 2: Learning Enhancements** 🚧
- [ ] Advanced command explanations
- [ ] Tutorial integration
- [ ] Progress indicators for learning
- [ ] Windows vs Linux concept translation

### **Phase 3: Advanced Features** 🎯
- [ ] WSL2 integration
- [ ] Batch operations
- [ ] Cloud storage support (S3, Drive)
- [ ] Plugin architecture for custom commands
- [ ] Mobile companion app

## 📜 **License**

Apache License 2.0 - See [LICENSE](LICENSE) file for details.

## 🙋‍♂️ **FAQ**

**Q: Do I need Linux experience to use Circle9?**
A: No! It's designed for Windows users who want to work with Linux without being Linux experts.

**Q: Is it secure?**
A: Very. Uses SSH protocol with your existing credentials. No data passes through third parties.

**Q: Why the "terminal pane"?**
A: Circle9's unique value - learn Linux commands by seeing GUI actions translated to CLI.

**Q: Can I use it without installing?**
A: Yes! Both portable `.exe` and installer versions available.

**Q: What if I already know Linux?**
A: Still useful! Faster than manual scp/rsync commands, with automatic permission mapping.

## 🙏 **Acknowledgements**

- **Built with Tauri** - Amazing framework for desktop apps
- **Inspired by frustration** - Too many hours spent on file operations
- **Community driven** - Anyone who has struggled with cross-platform workflows

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/solshaskie/Circle9/issues)
- **Discussions**: [GitHub Discussions](https://github.com/solshaskie/Circle9/discussions)
- **Docs**: See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for detailed setup

---

<div align="center">

**Circle9: Because `scp -p file.txt server:~/` shouldn't break your development flow**

⭐ **Star this repo** if Circle9 helped you!

<a href="https://github.com/solshaskie/Circle9"><img src="https://img.shields.io/github/stars/solshaskie/Circle9?style=social" alt="GitHub stars"></a>

</div>

---

*2024 · Built with ❤️ for lifelong Windows users embracing Linux*
