# ucanduit v2

A lightweight gamified productivity suite built with Tauri, featuring priority-based task management, kanban boards, and always-on-top floating windows.

## ✨ Features

### 🎯 Priority-Based Task Management
- **Smart Todo System**: Cycle through High, Medium, and Low priority tasks
- **Quick Actions**: Check off tasks directly from the compact priority view
- **Progress Tracking**: Visual progress indicators for all lists

### 📋 Kanban Board Integration
- **Full Workspace**: Dedicated kanban window for detailed task management
- **Drag & Drop**: Move tasks between To Do, In Progress, and Done columns
- **Priority Columns**: Organize lists by priority levels

### 🔄 Always-On Productivity
- **Floating Windows**: Stay on top of other applications
- **24/7 Operation**: Designed for continuous background use
- **Low Resource Usage**: <256MB memory target, <1% CPU idle

### 🧰 Integrated Tools
- **Pomodoro Timer**: Focus sessions with visual progress ring
- **Quick Memos**: Floating note-taking window
- **Weather Integration**: Stay informed while you work
- **Audio Oscilloscope**: Visual feedback for ambient audio

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **Rust** (latest stable)
- **Tauri CLI** (installed automatically)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TheIanM/microprod.git
   cd microprod
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run tauri:dev
   ```

### Building for Production

```bash
# Build the application
npm run tauri:build

# The built application will be in src-tauri/target/release/
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Backend**: Rust with Tauri framework
- **Storage**: Local JSON files for cross-platform compatibility
- **Audio**: Web Audio API for real-time visualization
- **UI Framework**: Custom modular tool system

### Project Structure
```
ucanduit-v2/
├── src/                    # Frontend source code
│   ├── tools/             # Modular productivity tools
│   │   ├── todo-list.js   # Priority-based todo system
│   │   ├── timer.js       # Pomodoro timer
│   │   └── ...
│   ├── kanban-window.html # Dedicated kanban workspace
│   ├── styles.css         # Shared styling system
│   └── ...
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   ├── tauri.conf.json    # Tauri configuration
│   └── Cargo.toml         # Rust dependencies
└── package.json           # Node.js dependencies
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start Vite development server
- `npm run build` - Build frontend for production
- `npm run tauri:dev` - Run Tauri development mode
- `npm run tauri:build` - Build complete application

### Tool Development
The application uses a modular tool system. Each tool extends the `ToolBase` class:

```javascript
import { ToolBase } from './tool-base.js';

export class MyTool extends ToolBase {
    constructor(container) {
        super(container);
    }
    
    async render() {
        // Tool-specific rendering logic
    }
}
```

### Data Storage
- All data is stored locally as JSON files
- Cross-platform compatibility ensured
- Automatic migration between data format versions

## 🎮 Usage

### Getting Started with Tasks
1. **Launch the application** - The main oscilloscope window appears
2. **Open Todo Tool** - Click the todo icon to see priority-based tasks
3. **Cycle Priorities** - Use the arrow button to cycle through High → Medium → Low
4. **Quick Actions** - Check off tasks directly or click to view full list
5. **Open Kanban** - Use the external link button for the full workspace

### Keyboard Shortcuts
- `Escape` - Close modal dialogs
- `Enter` - Submit forms
- `Ctrl+Enter` - Submit multi-line inputs

## 🔐 Privacy & Security

- **100% Local**: All data stays on your device
- **No Telemetry**: No tracking or analytics
- **Offline First**: Works without internet connection
- **Cross-Platform**: Your data works on macOS and Windows

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes following the existing code style
4. Test thoroughly on both development and built versions
5. Submit a pull request with a clear description

### Code Guidelines
- Use ES6+ JavaScript with modules
- Follow existing CSS class naming conventions
- Ensure tools extend `ToolBase` for consistency
- Test on both macOS and Windows when possible

## 📋 Performance Targets

- **Memory Usage**: <256MB (maximum 512MB)
- **CPU Usage**: <1% idle, <5% active
- **Startup Time**: <2 seconds
- **24/7 Operation**: No memory leaks or crashes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) - Thanks to the amazing Tauri team
- Icons from [Iconoir](https://iconoir.com/)
- Typography: [Quicksand](https://fonts.google.com/specimen/Quicksand) font family

---

**ucanduit v2** - *You can do it* ✨