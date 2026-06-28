---
name: Android share pipeline
description: Architecture and bug history for Ledge's Android receipt sharing pipeline (GPay/banking app → Ledge → AI analysis).
---

## Architecture

1. User shares payment screenshot from GPay/bank app → Android shows share sheet → user picks Ledge
2. Android delivers `ACTION_SEND` intent to the app's Activity
3. `LedgeShareHandlerModule.kt` (expo-modules-core) intercepts via `OnCreate` / `OnNewIntent` hooks → copies `content://` URI to internal cache as a stable `file://` path
4. JS polls `hasPendingShares()` every 2s in `_layout.js`; also `expo-share-intent` emits `hasShareIntent` as a backup signal
5. A "latch" ref in `_layout.js` remembers that a share is pending even while the user is on `/login` or `/change-password`
6. Once auth is complete, the app routes to `/share` (project selection screen)
7. User taps a project → navigate to `/project/[id]?sharedImage=<file://path>&shareTs=<ts>`
8. `project/[id].js` detects `sharedImage` param, downscales image via `prepareReceiptImage`, calls AI (`analyzeMessage`), shows category modal, saves transaction

## Root cause of original bugs

**Bug 1 — `handleIntent` was dead code**: `LedgeShareHandlerModule.kt` had a `companion object fun handleIntent(...)` but nothing ever called it. The Expo config plugin (`plugins/with-ledge-share-handler.js`) was supposed to inject calls into `MainActivity.kt`'s `onCreate`/`onNewIntent`, but the plugin file either didn't exist or had implementation bugs.

**Fix**: Replaced companion object calls with expo-modules-core's built-in `OnCreate { }` and `OnNewIntent { intent → }` DSL hooks directly inside the module definition. The module now self-registers for lifecycle events — no MainActivity patching needed.

**Bug 2 — Plugin file missing**: `app.json` referenced `./plugins/with-ledge-share-handler.js` which either didn't exist or would fail during `expo prebuild` / EAS Build.

**Fix**: Replaced the plugin with a no-op (`createRunOncePlugin` that returns config unchanged) since the module handles its own lifecycle.

**Bug 3 — Debug panel in share screen**: The production `/share` screen had a collapsible JSON debug panel showing raw share intent state.

**Fix**: Removed entirely in the rebuild.

**Bug 4 — Complex multi-source polling in share.js**: The share screen polled `getPendingShares()` every 1.2s as a fallback, creating race conditions with the latch in `_layout.js`.

**Fix**: Simplified — `share.js` calls `getPendingShares()` once on mount, then falls back to `expo-share-intent`'s `shareIntent`. No polling needed.

## Key file locations

- `modules/ledge-share-handler/android/.../LedgeShareHandlerModule.kt` — the native module with OnCreate/OnNewIntent hooks
- `modules/ledge-share-handler/index.ts` — JS API for the native module
- `plugins/with-ledge-share-handler.js` — no-op config plugin (required by app.json)
- `app/_layout.js` — share latch + auth-gated routing
- `app/share.js` — project selection screen
- `app/project/[id].js` — AI analysis and transaction commit

## Why OnCreate/OnNewIntent works for content:// URI safety

Android grants apps temporary read permission on `content://` URIs from share intents. This permission is tied to the Activity's intent and is revoked when the app goes to background or the share sheet closes. By copying the file in `OnCreate` (before the JS bundle starts loading) and `OnNewIntent` (before the app foregrounds), the copy always succeeds. The JS layer then receives a stable `file://` path that never expires.

## expo-modules-core DSL hooks used

```kotlin
OnCreate { 
    val activity = appContext.currentActivity ?: return@OnCreate
    processIntent(activity.intent, activity.contentResolver, activity.cacheDir)
}

OnNewIntent { intent ->
    val activity = appContext.currentActivity ?: return@OnNewIntent  
    processIntent(intent, activity.contentResolver, activity.cacheDir)
}
```

`appContext.currentActivity` is the correct accessor (not `appContext.activityProvider?.currentActivity`).
