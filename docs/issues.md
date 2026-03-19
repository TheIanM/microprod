# ucanduit Native — Open Issues

Last updated: 2026-02-25

---

## In Progress (current session)

### UI / Visual Parity
- [x] ~~Icons missing from section headers~~ → Fixed: IconoirIcon.swift created, solid/ deleted to avoid resource collision
- [ ] **Quicksand font not applied** — font is registered at startup but views still use system font. Needs `.font(.quicksand(...))` applied throughout (Task 11)
- [ ] **Buttons unstyled** — all views still use `.buttonStyle(.bordered)` etc. Needs UcanduitButtonStyle sweep (Task 11)
- [ ] **CollapsibleSection** — old chevron + grey bg style. New glass-card design with Iconoir icon + plus toggle being applied now (Task 6 ✓ ContentView.swift updated)
- [ ] **Oscilloscope size** — was 300×300, should be 380×380 (being applied, Task 9 ✓)

### Timer
- [ ] **Timer ring around oscilloscope** — original app shows a progress ring encircling the oscilloscope when a timer is active. TimerState.swift created, ContentView updated with ring overlay. Needs TimerView wired to TimerState.

### Module Ticker
- [ ] **Ticker / module carousel** — the original app has a UI element that cycles through the tool modules. Need to clarify: is this an auto-scroll carousel below the oscilloscope, or something else?

### Buttons / Labels
- [ ] **Button labels with IconoirIcon + Text may not render** — the pattern `Button { action } label: { HStack { IconoirIcon("plus", size: 13); Text("New Memo") } }` needs to be verified in-app. If the icon or text is invisible, it's likely an NSImage template rendering issue inside a SwiftUI label context. May need `.renderingMode(.template)` or a different composition approach.

### Memos
- [ ] **MemosView broken in panel** — uses `HSplitView` which doesn't fit in the 420pt panel. Needs replacing with VStack (list on top, editor below).

### Lo-Fi Music
- [ ] **Missing Next / Back track buttons** — current UI only has play/stop. Need to add Previous and Next buttons + track the current index.
- [ ] **Track list empty until audio files added** — the file scanner filters for directories named "lofi". Benign until user adds audio.

### Ambient Sounds
- [ ] **Shows only slider** — this happens when no audio directories are found (no ambient sound files added yet). UI is technically correct but empty.

### Weather
- [ ] **Condition shows "unknown"** — `parseWeatherXML` initialises to "unknown" and the `<title>Current Conditions: ...` regex sometimes fails. Needs investigation once live with real network.
- [ ] **No "last checked" timestamp** — WeatherView doesn't display `weather.timestamp`. Need to add "Updated X minutes ago" display.
- [ ] **Auto-location** — weather is hardcoded to Toronto. Defer to later session; need to decide on API (Environment Canada needs city codes, Open-Meteo takes lat/lng).

### Settings
- [ ] **Settings view needs complete rework** — defer until all other views are wired up.

---

## Deferred

- [ ] iOS layout / AdaptiveNavigationView polish (post-macOS parity)
- [ ] Audio file conversion to reduce bundle size (user will handle)
- [ ] Settings view rework
- [ ] Weather auto-location (API decision needed: keep EC + lookup table, or switch to Open-Meteo)
