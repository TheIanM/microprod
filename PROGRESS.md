# ucanduit v2 — Progress Log

## Session: 2026-02-16

### What Was Done

#### 1. CSS Build Fix — timer.css
- **File**: `ucanduit-v2/src/tools/timer.css`
- Removed invalid `<style>` / `</style>` HTML tags wrapping the CSS file
- Vite now bundles it without warnings

#### 2. Vite Multi-Page Build Configuration
- **File**: `ucanduit-v2/vite.config.js`
- Added `build.rollupOptions.input` with all 7 HTML entry points (main, splash, timer, memo, kanban, weather, settings)
- All sub-window HTML files now compile into `dist/` during production builds

#### 3. Tauri Splash URL Fix
- **File**: `ucanduit-v2/src-tauri/tauri.conf.json`
- Changed splash URL from `../src/splash.html` to `src/splash.html` (resolves correctly against `dist/` in production)
- Changed bundle targets from `"all"` to `["app"]` (skipping DMG — `create-dmg` not installed)

#### 4. Oscilloscope / Goo Creature Revamp
- **File**: `ucanduit-v2/src/tools/oscilloscope.js`
- Replaced old `drawMetaballs()` / `drawMetaballsMask()` / `drawMetaballOutline()` with new `drawMergedMetaballs()`
- New rendering pipeline:
  1. Renders metaball gradients to offscreen canvas
  2. Alpha-thresholds pixel data to create merged silhouette (blobs fuse together)
  3. Uses silhouette as clipping mask via `destination-in` compositing
  4. Draws breathing background only inside the mask (goo reveals colorful inner light)
  5. Adds outline/glow tinted with complementary color, responsive to audio amplitude
- Boosted audio reactivity: larger radius expansion (55 vs 35), stronger movement influence (1.8 vs 0.8)
- Demo mode now pulses more visibly and feeds amplitude into glow

#### 5. Lo-Fi endsWith Bug Fix
- **File**: `ucanduit-v2/src/tools/lofi.js`
- Fixed `.endsWith('.mp3', '.wav')` → proper `!lower.endsWith('.mp3') && !lower.endsWith('.wav')`

#### 6. Missing `oscilloscope` Variable Fix
- **File**: `ucanduit-v2/index.html`
- 4 references to bare `oscilloscope` variable changed to `window.oscilloscopeTool`
- Fixed: `toggleDemo()`, `timerUpdate()`, `timerComplete()`
- Timer now works and ring appears around OSSC

#### 7. Sub-Window URLs Fixed for Production
- **Files**: `timer.js`, `memos.js`, `todo-list.js`, `weather.js`, `index.html`
- All `../src/` and `./src/` URL paths changed to `src/` (works in both dev and production)
- Affects WebviewWindow constructors and window.open() fallbacks

#### 8. GitHub Actions CI Workflow
- **File**: `.github/workflows/build.yml`
- Builds for macOS (universal binary), Windows, and Linux
- Triggers on version tags (`v*`) or manual dispatch
- Creates draft GitHub Release with installers

### Production Build Status
- **Vite build**: Passes cleanly, all HTML files in `dist/`
- **Rust compilation**: Succeeds (release profile)
- **`.app` bundle**: Created successfully, launches and shows splash + main window
- **`.dmg` packaging**: Skipped (needs `create-dmg` installed via Homebrew)

### Known Bugs (Production Build)
- **Modules don't load**: Splash and main window render, but no tool sections (timer, todos, memos, etc.) populate. Buttons don't work either.
  - Likely cause: JS module imports or initialization failing silently in production context
  - Needs investigation — could be CSP blocking, path resolution, or Tauri API availability issue

### Known Issues (Not Yet Addressed)
- `skycons.js` script in `weather-details.html` missing `type="module"` attribute (Vite warning)
- `styles.css` bundle is ~2.8MB (iconoir CSS library — could benefit from tree-shaking)
- Weather is hardcoded to Toronto
- Audio reactivity present but subtle — user wants to revisit this
- Lo-Fi and Ambient tools depend on Tauri backend for file scanning (partially functional)

### Files Modified This Session
```
ucanduit-v2/src/tools/timer.css
ucanduit-v2/vite.config.js
ucanduit-v2/src-tauri/tauri.conf.json
ucanduit-v2/src/tools/oscilloscope.js
ucanduit-v2/src/tools/lofi.js
ucanduit-v2/index.html
ucanduit-v2/src/tools/memos.js
ucanduit-v2/src/tools/timer.js
ucanduit-v2/src/tools/todo-list.js
ucanduit-v2/src/tools/weather.js
.github/workflows/build.yml  (new)
```
