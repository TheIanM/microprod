# Security Audit - ucanduit v0.1.0

**Date:** 2026-02-25
**Branch:** `security/input-sanitization-audit`
**Files Analyzed:** 40+ source files (JS, HTML, Rust, JSON)

---

## Summary

| # | Severity | Issue | Location | Status |
|---|----------|-------|----------|--------|
| 1 | HIGH | XSS - unescaped user text in todo-list rendering | `src/tools/todo-list.js` | FIXED |
| 2 | HIGH | XSS - unescaped user text in kanban rendering | `src/kanban-window.html` | FIXED |
| 3 | MEDIUM | XSS - unescaped title in memo window header | `src/memo-window.html:365` | FIXED |
| 4 | MEDIUM | Open redirect via memo link opening | `src/memo-window.html:510-535` | FIXED |
| 5 | LOW | No path traversal check in audio scanning | `src-tauri/src/lib.rs:104-113` | FIXED |
| 6 | LOW | No filename allowlist for JSON file commands | `src-tauri/src/lib.rs:197,222` | FIXED |
| 7 | MEDIUM | Asset protocol scope too broad | `src-tauri/tauri.conf.json:32` | FIXED |

---

## Detailed Findings

### 1. HIGH: XSS in Todo List Tool

**File:** `src/tools/todo-list.js`
**Lines:** 293, 337, 371, 404, 419

User-provided list names and item text are interpolated directly into template
literals assigned to element.innerHTML without HTML escaping. Malicious input
like `<img src=x onerror=alert(1)>` would execute JavaScript in the app context.

**Affected locations:**
- Line 293: breadcrumb renders `activeList.name` unescaped
- Line 337: list view renders `list.name` unescaped
- Line 371: item view renders `item.text` unescaped
- Line 404: priority list title renders `list.name` unescaped
- Line 419: compact item renders `item.text` unescaped

**Fix:** Add `escapeHtml()` method (same pattern used in `memos.js:361-365`) and
wrap all user-provided text before inserting into HTML templates.

---

### 2. HIGH: XSS in Kanban Window

**File:** `src/kanban-window.html`
**Lines:** 425, 475, 511

Same class of issue as finding #1 - the kanban board renders list names and item
text directly in HTML templates without escaping.

**Affected locations:**
- Line 425: list card title renders `list.name` unescaped
- Line 475: breadcrumb renders `list.name` unescaped
- Line 511: item card renders `item.text` unescaped

**Fix:** Add standalone `escapeHtml()` function and wrap all user-provided text.

---

### 3. MEDIUM: XSS in Memo Window Title

**File:** `src/memo-window.html`
**Line:** 365

The `updateWindowTitle()` method uses element.innerHTML to set the window title,
injecting the memo title (derived from user content) without escaping. The title
is generated from memo content first line.

**Fix:** Build the title element safely using DOM methods (createElement +
textContent) instead of string interpolation into innerHTML.

---

### 4. MEDIUM: Open Redirect in Memo Link Opening

**File:** `src/memo-window.html`
**Lines:** 510-535

The `openUrl()` method opens URLs detected in memo text. For non-http URLs, it
blindly prepends `https://`. The `shell.open()` Tauri API delegates to the OS,
which could handle arbitrary URI schemes depending on platform.

**Fix:** Validate that the final URL uses an allowed protocol (`http:`, `https:`,
`mailto:`) before opening. Reject all other schemes.

---

### 5. LOW: No Path Traversal Check in Audio Scanning

**File:** `src-tauri/src/lib.rs`
**Lines:** 104-113

The `scan_audio_directory` command accepts a `directory_path` string and resolves
it relative to the audio base directory. While the path is normalized by stripping
prefixes, there is no explicit check for `..` segments that could escape the
audio directory.

**Fix:** After resolving the full path, verify it is still a child of the audio
base directory using `starts_with()`.

---

### 6. LOW: No Filename Allowlist for JSON File Commands

**File:** `src-tauri/src/lib.rs`
**Lines:** 197, 222

The `write_json_file` and `read_json_file` commands accept any filename string.
While filenames are currently app-controlled (not user input), defense-in-depth
suggests validating against a known pattern.

**Fix:** Validate that filenames match the `ucanduit-*.json` pattern and contain
no path separators (`/`, `\`).

---

### 7. MEDIUM: Asset Protocol Scope Too Broad

**File:** `src-tauri/tauri.conf.json`
**Line:** 32

The asset protocol scope is `["**"]`, which allows the asset protocol to serve
any file accessible by the app. This should be restricted to only the
directories that need asset access.

**Fix:** Restrict scope to specific paths like `["$RESOURCE/audio/**"]`.

---

## What is Already Secure

- **Memos tool** (`memos.js`) correctly uses `escapeHtml()` for all rendered text
- **Tauri IPC commands** use type-safe Serde serialization
- **Weather API** uses hardcoded HTTPS endpoints with no user URL injection
- **File storage** uses `JSON.parse()`/`JSON.stringify()` safely (no eval)
- **CSP** blocks external script loading and `unsafe-eval`
- **No hardcoded secrets** or API keys in the codebase
- **Audio file loading** restricted to relative paths and known extensions
- **Status messages** use `textContent` (not innerHTML) throughout

---

## Notes

- The `unsafe-inline` directive in CSP `script-src` is currently necessary because
  several HTML files use inline `<script type="module">` blocks. Removing this
  would require extracting all inline scripts to external files - a larger refactor
  that should be tracked separately.
- Data at rest (JSON files) is unencrypted. For a local productivity app this is
  acceptable but worth noting.
