# UI Parity & Bug Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two critical runtime bugs (weather network, blank oscilloscope), establish the Iconoir + Quicksand asset pipeline, and bring the native SwiftUI app to full visual parity with the original Tauri/CSS design.

**Architecture:** Surgical file-by-file changes. Shared infrastructure (font, icon loader, button style, environment value) created first so every subsequent task can depend on it. No new dependencies — fonts and SVGs are bundled, NSImage handles SVG on macOS natively.

**Tech Stack:** Swift, SwiftUI, AppKit (NSImage for SVG), CoreText (font registration), SF Symbols `.symbolEffect` (weather animation)

---

## Task Status

| Task | Description | Status |
|------|-------------|--------|
| 1 | Network Entitlements | ⏳ Not started |
| 2 | Quicksand Font Registration | ⏳ Not started |
| 3 | Oscilloscope Fix | ⏳ Not started |
| 4 | Iconoir Icon System + Cleanup | ⏳ Not started |
| 5 | isEmbedded Environment Value | ⏳ Not started |
| 6 | CollapsibleSection Redesign | ⏳ Not started |
| 7 | UcanduitButtonStyle | ⏳ Not started |
| 8 | Apply Nested Scroll Fix | ⏳ Not started |
| 9 | Window + Oscilloscope Sizing | ⏳ Not started |
| 10 | Animated Weather SF Symbols | ⏳ Not started |
| 11 | Apply Icons + Button Style | ⏳ Not started |

---

## Key File Paths

All Swift source files live under:
`ucanduit-apple/ucanduit/ucanduit/`

Referred to below as `SOURCE/` for brevity.

Brand colors (from styles.css :root):
- udu-green: `Color(red: 0.306, green: 0.812, blue: 0.616)` — #4ecf9d
- candu-blue: `Color(red: 0.247, green: 0.533, blue: 0.773)` — #3f88c5
- not-black: `Color(red: 0.165, green: 0.176, blue: 0.204)` — #2a2d34

---

## Task 1: Network Entitlements (Weather Fix)

**Files:**
- Create: `SOURCE/ucanduit.entitlements`

**Step 1: Create the entitlements file**

Create `ucanduit-apple/ucanduit/ucanduit/ucanduit.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

**Step 2: Wire it up in Xcode**

Open Xcode → click the `ucanduit` project in the navigator → select the `ucanduit` target → go to **Signing & Capabilities** tab.

Under **App Sandbox**, tick **Outgoing Connections (Client)**. Xcode will set `CODE_SIGN_ENTITLEMENTS` in the build settings to point at the file you just created. Verify it appears as `ucanduit/ucanduit.entitlements` in the build settings.

**Step 3: Verify**

`Cmd+B` — must build clean. Run the app, open the Weather section, tap Refresh. Should now fetch data instead of showing the "look out a window" error.

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/ucanduit.entitlements
git add ucanduit-apple/ucanduit/ucanduit.xcodeproj/project.pbxproj
git commit -m "fix: add network entitlements to fix weather fetch in sandboxed app"
```

---

## Task 2: Quicksand Font Registration

**Files:**
- Modify: `SOURCE/ucanduitApp.swift`
- Create: `SOURCE/Extensions/Font+Quicksand.swift`

The variable font `Quicksand/Quicksand-VariableFont_wght.ttf` covers all weights. Register it once at app startup via CoreText so SwiftUI can find it by name.

**Step 1: Register font in app entry point**

Add an `init()` to `UcanduitApp` in `ucanduitApp.swift`:

```swift
import SwiftUI
import SwiftData
import CoreText  // add this import

@main
struct UcanduitApp: App {
    // ... existing sharedModelContainer ...

    init() {
        registerFonts()
    }

    var body: some Scene {
        // ... unchanged ...
    }

    private func registerFonts() {
        guard let url = Bundle.main.url(
            forResource: "Quicksand-VariableFont_wght",
            withExtension: "ttf",
            subdirectory: "Quicksand"
        ) else {
            print("⚠️ Quicksand font not found in bundle")
            return
        }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }
}
```

**Step 2: Create font convenience extension**

Create `SOURCE/Extensions/Font+Quicksand.swift`:

```swift
import SwiftUI

extension Font {
    /// Quicksand at a given size and weight. Falls back to system font
    /// gracefully if the font failed to register.
    static func quicksand(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.custom("Quicksand", size: size).weight(weight)
    }
}
```

**Step 3: Verify**

`Cmd+B`. Add a temporary `Text("test").font(.quicksand(16, weight: .semibold))` somewhere visible to confirm the font renders — it should look rounded vs. the system font. Remove the test text after confirming.

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/ucanduitApp.swift \
        ucanduit-apple/ucanduit/ucanduit/Extensions/Font+Quicksand.swift
git commit -m "feat: register Quicksand variable font at startup via CoreText"
```

---

## Task 3: Oscilloscope Fix

**Files:**
- Modify: `SOURCE/Views/Oscilloscope/OscilloscopeView.swift`

**Root cause:** Physics updates (`updateBalls`, `updateAudio`) are called inside the `Canvas` drawing closure. In Swift 6, mutations inside Canvas closures don't persist back to `@State` — the closure captures a value-type copy. So `balls` and `circles` stay empty after init, drawing nothing.

**Fix:** Move state mutations to a `Timer.publish` receiver outside Canvas. Canvas becomes purely read-only.

**Step 1: Replace the body and timer setup**

Replace the entire `body` property and add the timer. Keep ALL existing private functions (`initializeIfNeeded`, `updateBalls`, `updateAudio`, `drawMetaballs`, etc.) exactly as they are — only the wiring changes.

```swift
// Add this property alongside the existing @State vars:
private let timer = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common).autoconnect()

var body: some View {
    Canvas { context, canvasSize in
        // READ-ONLY — no state mutations here
        let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
        let bounds = CGRect(origin: .zero, size: canvasSize)
        drawMetaballs(context: context, bounds: bounds, center: center)
    }
    .frame(width: size.width, height: size.height)
    .onAppear { initializeIfNeeded() }
    .onReceive(timer) { _ in
        // Physics runs here — @State mutations in onReceive ARE safe
        guard isInitialized else { return }
        let bounds = CGRect(origin: .zero, size: size)
        updateBalls(in: bounds)
        updateAudio()
    }
}
```

Remove the `TimelineView` wrapper — it's replaced by the timer. Remove the old `Canvas` block that called `updateBalls`/`updateAudio` inside it.

**Step 2: Verify**

`Cmd+B`, run the app. The oscilloscope should show animated purple/blue metaballs immediately on launch, even with no audio playing.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Views/Oscilloscope/OscilloscopeView.swift
git commit -m "fix: move oscilloscope physics to Timer receiver — Canvas is now read-only"
```

---

## Task 4: Iconoir Icon System + SVG Cleanup

**Files:**
- Delete: all SVGs in `SOURCE/icons/solid/` and `SOURCE/icons/regular/` that aren't in the keep list below
- Create: `SOURCE/Views/IconoirIcon.swift`

**Keep list — regular:**
`timer`, `task-list`, `notes`, `music-note`, `sound-high`, `cloud-sunny`, `settings`, `plus`, `trash`, `check`, `edit-pencil`, `refresh`, `nav-arrow-left`, `nav-arrow-right`, `nav-arrow-up`, `nav-arrow-down`, `play`, `pause`, `flash`, `coffee-cup`, `brain`, `priority-up`, `priority-medium`, `priority-down`, `xmark`, `xmark-circle`, `plus-circle`, `sound-off`, `list`

**Keep list — solid:**
`priority-up`, `priority-medium`, `priority-down`, `play`, `pause`, `music-note`, `trash`, `plus-circle`, `sound-high`, `sound-off`

**Step 1: Delete unused SVGs**

```bash
# Delete everything in solid/ not in the keep list — run from project root
cd ucanduit-apple/ucanduit/ucanduit

# Keep only the files we need in solid/ — delete the rest
find icons/solid -name "*.svg" | while read f; do
  base=$(basename "$f" .svg)
  case "$base" in
    priority-up|priority-medium|priority-down|play|pause|music-note|trash|plus-circle|sound-high|sound-off) ;;
    *) rm "$f" ;;
  esac
done

# Keep only the files we need in regular/ — delete the rest
find icons/regular -name "*.svg" | while read f; do
  base=$(basename "$f" .svg)
  case "$base" in
    timer|task-list|notes|music-note|sound-high|cloud-sunny|settings|plus|trash|check|edit-pencil|refresh|nav-arrow-left|nav-arrow-right|nav-arrow-up|nav-arrow-down|play|pause|flash|coffee-cup|brain|priority-up|priority-medium|priority-down|xmark|xmark-circle|plus-circle|sound-off|list) ;;
    *) rm "$f" ;;
  esac
done
```

Verify counts:
```bash
echo "Solid: $(ls icons/solid/*.svg | wc -l)"   # expect ~10
echo "Regular: $(ls icons/regular/*.svg | wc -l)" # expect ~29
```

**Step 2: Create IconoirIcon view**

Create `SOURCE/Views/IconoirIcon.swift`:

```swift
import SwiftUI
#if os(macOS)
import AppKit
#endif

/// Renders an Iconoir SVG icon from the app bundle.
///
/// SVGs are loaded via NSImage on macOS (native SVG support, macOS 10.15+).
/// isTemplate = true makes them tintable with .foregroundStyle().
///
/// Usage:
///   IconoirIcon("timer")                        // regular, 20pt, primary color
///   IconoirIcon("play", style: "solid", size: 16)
///   IconoirIcon("trash").foregroundStyle(.red)
struct IconoirIcon: View {
    let name: String
    var style: String = "regular"
    var size: CGFloat = 20

    var body: some View {
        #if os(macOS)
        if let image = loadSVG() {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            // Fallback so missing icons don't silently break layout
            Image(systemName: "questionmark.circle")
                .frame(width: size, height: size)
        }
        #else
        // iOS: bundle SVG loading requires asset catalog — using SF Symbol fallback
        // TODO: add iOS icon support when needed
        Image(systemName: "circle")
            .frame(width: size, height: size)
        #endif
    }

    #if os(macOS)
    private func loadSVG() -> NSImage? {
        guard let url = Bundle.main.url(
            forResource: name,
            withExtension: "svg",
            subdirectory: "icons/\(style)"
        ) else { return nil }
        let image = NSImage(contentsOf: url)
        image?.isTemplate = true  // allows .foregroundStyle() tinting
        return image
    }
    #endif
}
```

**Step 3: Verify**

`Cmd+B`. Add `IconoirIcon("timer")` somewhere temporarily to confirm it renders. The icon should appear and be tintable. Remove the test after confirming.

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/icons/ \
        ucanduit-apple/ucanduit/ucanduit/Views/IconoirIcon.swift
git commit -m "feat: add IconoirIcon SVG loader and trim icon set to used icons only"
```

---

## Task 5: isEmbedded Environment Value

**Files:**
- Create: `SOURCE/Extensions/EnvironmentValues+IsEmbedded.swift`

Tool views (TodoList, Memos, LofiPlayer, AmbientSounds) embed `List` views. When these are inside `CollapsibleSection` inside the outer `ScrollView`, scroll gestures conflict. The fix: `CollapsibleSection` sets `isEmbedded = true` in the environment; views that have Lists read it and call `.scrollDisabled(true)`.

**Step 1: Create the environment key**

Create `SOURCE/Extensions/EnvironmentValues+IsEmbedded.swift`:

```swift
import SwiftUI

private struct IsEmbeddedKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when this view is rendered inside a CollapsibleSection.
    /// Views with internal List/ScrollView should call .scrollDisabled(isEmbedded).
    var isEmbedded: Bool {
        get { self[IsEmbeddedKey.self] }
        set { self[IsEmbeddedKey.self] = newValue }
    }
}
```

**Step 2: Verify**

`Cmd+B` — clean build.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Extensions/EnvironmentValues+IsEmbedded.swift
git commit -m "feat: add isEmbedded environment value for nested scroll management"
```

---

## Task 6: CollapsibleSection Redesign

**Files:**
- Modify: `SOURCE/ContentView.swift`

Replace the current `CollapsibleSection` and update the call sites to pass icons. This is the core visual parity change — glass card style matching the original CSS exactly.

**Step 1: Replace CollapsibleSection**

Replace the entire `CollapsibleSection` struct in `ContentView.swift` with:

```swift
/// Glass-card accordion section matching the original .collapsible-section CSS.
///
/// CSS reference (styles.css lines 393-403):
///   background: rgba(255,255,255,0.2) + backdrop-filter: blur(10px) → .ultraThinMaterial
///   border-radius: 15px
///   border: .1px solid var(--not-black)
///   box-shadow: 0 2px 8px rgba(0,0,0,0.2)
///
/// Toggle icon: Iconoir "plus" at 45° (expanded) or 90° (collapsed)
struct CollapsibleSection<Content: View>: View {
    let title: String
    let icon: String          // Iconoir regular icon name
    let content: () -> Content
    @State private var isExpanded = false

    init(_ title: String, icon: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 10) {
                    IconoirIcon(icon, style: "regular", size: 18)
                        .foregroundStyle(.primary)
                    Text(title)
                        .font(.quicksand(16, weight: .semibold))
                        .foregroundStyle(.primary)
                    Spacer()
                    IconoirIcon("plus", style: "regular", size: 16)
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 45 : 90))
                        .animation(.easeInOut(duration: 0.2), value: isExpanded)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            if isExpanded {
                content()
                    .environment(\.isEmbedded, true)  // disables inner List scrolling
                    .padding(.horizontal, 15)
                    .padding(.bottom, 25)
            }
        }
        .background(.ultraThinMaterial)                    // rgba(255,255,255,0.2) + blur
        .clipShape(RoundedRectangle(cornerRadius: 15))     // border-radius: 15px
        .overlay {
            RoundedRectangle(cornerRadius: 15)
                .stroke(
                    Color(red: 0.165, green: 0.176, blue: 0.204).opacity(0.3),
                    lineWidth: 0.5                         // border: .1px solid --not-black
                )
        }
        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)  // box-shadow
    }
}
```

**Step 2: Update macOSLayout call sites**

In the `macOSLayout` computed property, add the `icon:` parameter to each section:

```swift
CollapsibleSection("Timer",          icon: "timer")       { TimerView() }
CollapsibleSection("Todo Lists",     icon: "task-list")   { TodoListView() }
CollapsibleSection("Quick Memos",    icon: "notes")       { MemosView() }
CollapsibleSection("Lo-Fi Music",    icon: "music-note")  { LofiPlayerView() }
CollapsibleSection("Ambient Sounds", icon: "sound-high")  { AmbientSoundsView() }
CollapsibleSection("Weather",        icon: "cloud-sunny") { WeatherView() }
CollapsibleSection("Settings",       icon: "settings")    { SettingsView() }
```

**Step 3: Verify**

`Cmd+B`, run app. Sections should now show as glass cards with Iconoir icons in the header. The `+` toggle should animate between 45° and 90°.

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/ContentView.swift
git commit -m "feat: redesign CollapsibleSection to match original glass-card CSS style"
```

---

## Task 7: UcanduitButtonStyle

**Files:**
- Create: `SOURCE/Styles/UcanduitButtonStyle.swift`

The original CSS button: near-transparent background, 2px left green border, 4px radius, Quicksand font, hover lifts with blue border. In SwiftUI, pressed state replaces hover.

**Step 1: Create the style**

Create `SOURCE/Styles/UcanduitButtonStyle.swift`:

```swift
import SwiftUI

/// Matches the original button CSS:
///   background: rgba(42,45,52,0.03)
///   border-left: 2px solid var(--udu-green)  →  candu-blue on press
///   border-radius: 4px
///   font: Quicksand 14px weight 500
struct UcanduitButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.quicksand(14, weight: .medium))
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .background(
                // rgba(42,45,52,0.03) normal, 0.08 on press
                Color(red: 0.165, green: 0.176, blue: 0.204)
                    .opacity(configuration.isPressed ? 0.08 : 0.03)
            )
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(alignment: .leading) {
                // The signature left border — green normally, blue on press
                RoundedRectangle(cornerRadius: 1)
                    .fill(
                        configuration.isPressed
                            ? Color(red: 0.247, green: 0.533, blue: 0.773)  // candu-blue
                            : Color(red: 0.306, green: 0.812, blue: 0.616)  // udu-green
                    )
                    .frame(width: 2)
            }
            .scaleEffect(y: configuration.isPressed ? 0.97 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == UcanduitButtonStyle {
    static var ucanduit: UcanduitButtonStyle { UcanduitButtonStyle() }
}
```

**Step 2: Verify**

`Cmd+B`. Add a temporary `Button("Test") {}.buttonStyle(.ucanduit)` to confirm the left border, near-transparent background, and press animation work. Remove after confirming.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Styles/UcanduitButtonStyle.swift
git commit -m "feat: add UcanduitButtonStyle with green left border matching original CSS"
```

---

## Task 8: Apply Nested Scroll Fix

**Files:**
- Modify: `SOURCE/Views/Todos/TodoListView.swift`
- Modify: `SOURCE/Views/Memos/MemosView.swift`
- Modify: `SOURCE/Views/Audio/LofiPlayerView.swift`
- Modify: `SOURCE/Views/Audio/AmbientSoundsView.swift`

In each file, add the environment read and apply `.scrollDisabled(isEmbedded)` to the inner `List`.

**Step 1: TodoListView.swift**

Add near the top of `TodoListView`:
```swift
@Environment(\.isEmbedded) private var isEmbedded
```

Find the `List {` and append:
```swift
.scrollDisabled(isEmbedded)
```

**Step 2: MemosView.swift**

Same pattern — add `@Environment(\.isEmbedded) private var isEmbedded` and `.scrollDisabled(isEmbedded)` on the `List`.

**Step 3: LofiPlayerView.swift**

Same pattern on the `List { ForEach(files) ... }`.

**Step 4: AmbientSoundsView.swift**

Same pattern on the `List { ForEach(categories) ... }`.

**Step 5: Verify**

`Cmd+B`. Open the app, expand "Todo Lists" or "Lo-Fi Music" inside the panel. Scrolling the panel should scroll the whole view without getting stuck in the inner list.

**Step 6: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Views/Todos/TodoListView.swift \
        ucanduit-apple/ucanduit/ucanduit/Views/Memos/MemosView.swift \
        ucanduit-apple/ucanduit/ucanduit/Views/Audio/LofiPlayerView.swift \
        ucanduit-apple/ucanduit/ucanduit/Views/Audio/AmbientSoundsView.swift
git commit -m "fix: disable inner List scrolling when embedded in CollapsibleSection"
```

---

## Task 9: Window + Oscilloscope Sizing

**Files:**
- Modify: `SOURCE/ContentView.swift`

**Step 1: Update sizes in macOSLayout**

Find and change:
```swift
// FROM:
OscilloscopeView(frequencyData: audioEngine.frequencyData)
    .frame(width: 300, height: 300)
// TO:
OscilloscopeView(frequencyData: audioEngine.frequencyData)
    .frame(width: 380, height: 380)
```

Find and change:
```swift
// FROM:
.frame(minWidth: 350, maxWidth: 400)
// TO:
.frame(width: 420)
```

**Step 2: Verify**

`Cmd+B`, run. The oscilloscope should be noticeably larger and fill the panel width better.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/ContentView.swift
git commit -m "fix: increase oscilloscope to 380×380 and fix window to 420pt width"
```

---

## Task 10: Animated Weather SF Symbols

**Files:**
- Modify: `SOURCE/Views/Weather/WeatherView.swift`

SF Symbols `.symbolEffect(.variableColor.iterative.reversing)` animates the variable-color layers of weather symbols — raindrops fall, snowflakes cascade, lightning flashes. Requires macOS 14+ / iOS 17+ (already our minimum).

**Step 1: Add symbolEffect to the weather icon**

In `WeatherView.body`, find the `Image(systemName: conditionIcon(weather.condition))` line and add:

```swift
Image(systemName: conditionIcon(weather.condition))
    .font(.title2)
    .symbolEffect(.variableColor.iterative.reversing, options: .repeating)
```

**Step 2: Verify**

`Cmd+B`, run. Open Weather section. If weather loads, the icon should animate — rain icon shows cascading drops, sun icon pulses. Even without real data you can test by temporarily hardcoding `condition: "rain"` in `WeatherView`.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Views/Weather/WeatherView.swift
git commit -m "feat: animate weather SF Symbols using variableColor iterative effect"
```

---

## Task 11: Apply Iconoir Icons + Button Style Across All Views

**Files:**
- Modify: `SOURCE/Views/Timer/TimerView.swift`
- Modify: `SOURCE/Views/Todos/TodoListView.swift`
- Modify: `SOURCE/Views/Memos/MemosView.swift`
- Modify: `SOURCE/Views/Audio/LofiPlayerView.swift`
- Modify: `SOURCE/Views/Audio/AmbientSoundsView.swift`
- Modify: `SOURCE/Views/Weather/WeatherView.swift`
- Modify: `SOURCE/Views/Settings/SettingsView.swift`

**Button style changes — replace in each file:**

| Old | New |
|-----|-----|
| `.buttonStyle(.bordered)` | `.buttonStyle(.ucanduit)` |
| `.buttonStyle(.borderedProminent)` | `.buttonStyle(.ucanduit)` |
| (no style on action buttons) | `.buttonStyle(.ucanduit)` |

Keep `.buttonStyle(.plain)` ONLY on icon-only buttons (play/stop icon buttons in audio views, row buttons in lists) — `.plain` is correct there since `.ucanduit` is for text buttons.

**Icon changes — replace SF Symbols with Iconoir where available:**

In `TimerView.swift`, replace preset SF Symbol icons with Iconoir equivalents:
```swift
// Flash (pomodoro):
IconoirIcon("flash", size: 22)
// Coffee (short break):
IconoirIcon("coffee-cup", size: 22)
// Timer (long break):
IconoirIcon("timer", size: 22)
// Brain (focus):
IconoirIcon("brain", size: 22)
```

In `TodoListView.swift`, replace priority badges:
```swift
// High priority:
IconoirIcon("priority-up", style: "solid", size: 14).foregroundStyle(.red)
// Medium:
IconoirIcon("priority-medium", style: "solid", size: 14).foregroundStyle(.orange)
// Low:
IconoirIcon("priority-down", style: "solid", size: 14).foregroundStyle(.green)
```

In `LofiPlayerView.swift`:
```swift
// Play button:
IconoirIcon(audioEngine.isLofiPlaying ? "pause" : "play", size: 22)
// Now playing indicator:
IconoirIcon("music-note", size: 14)
```

In `AmbientSoundsView.swift`:
```swift
// Playing state:
IconoirIcon(playingIds.contains(category.name) ? "sound-high" : "play", style: "solid", size: 22)
// Stop all:
IconoirIcon("sound-off", size: 16) — use in "Stop All" button label
```

In `MemosView.swift`:
```swift
// New memo button:
IconoirIcon("plus", size: 16)
// Delete:
IconoirIcon("trash", size: 16).foregroundStyle(.red)
```

In `WeatherView.swift`:
```swift
// Refresh button label:
IconoirIcon("refresh", size: 16)
```

**Step 1: Apply all changes above**

Work file by file. `Cmd+B` after each file to catch errors immediately.

**Step 2: Final verify**

`Cmd+B`, run. Walk through every expanded section. Check:
- [ ] All text buttons use the left-green-border style
- [ ] Priority icons show Iconoir arrows
- [ ] Timer preset icons show Iconoir variants
- [ ] Audio controls show Iconoir play/pause/sound icons
- [ ] No broken icons (fallback `?` circle visible)

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/ucanduit/Views/
git commit -m "feat: apply Iconoir icons and UcanduitButtonStyle across all views"
```

---

## Final Verification Checklist

After all tasks complete:

- [ ] Weather loads real data (no "look out a window" error)
- [ ] Oscilloscope shows animated metaballs
- [ ] Quicksand font visible in all section titles and buttons
- [ ] Section headers show glass card with Iconoir icon + `+` toggle
- [ ] Button left-green-border visible throughout
- [ ] Scrolling the panel scrolls smoothly (no stuck inner lists)
- [ ] Oscilloscope is 380×380 in a 420pt wide panel
- [ ] Weather icon animates
- [ ] No SF Symbol fallbacks visible where Iconoir should appear
