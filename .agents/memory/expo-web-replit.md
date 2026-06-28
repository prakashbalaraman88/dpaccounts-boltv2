---
name: Expo web on Replit
description: Required fixes to run an Expo/React Native app in web mode inside Replit's environment.
---

## Rules

1. **Native modules must use `requireOptionalNativeModule`** — Any custom native Expo module that calls `requireNativeModule` at module scope will throw on web and crash the entire layout before auth initializes. Change to `requireOptionalNativeModule` and add `?.` null-safe calls everywhere the result is used.

**Why:** `requireNativeModule` throws if the native module is absent (always the case on web). The error propagates before any ErrorBoundary can catch it, causing a permanent splash/loading screen.

**How to apply:** Audit any `modules/*/index.ts` files for `requireNativeModule` and replace with `requireOptionalNativeModule` from `expo-modules-core`.

2. **Do NOT use `--host localhost` with `expo start`** — This makes Metro bind to `127.0.0.1` only. Replit's proxy needs the server on `0.0.0.0`. Without the flag, Metro defaults to LAN mode and binds to all interfaces.

**Why:** Replit's webview proxy can't reach a localhost-only socket; open ports will show `null` and the canvas shows "Your app is starting..." forever.

**How to apply:** Use `RCT_METRO_PORT=5000 npx expo start --web --port 5000` (no `--host` flag).

3. **Set `CI=1` to bypass interactive prompts** — Expo CLI may pause to ask "Log in or proceed anonymously" in a non-TTY environment, blocking the server from starting.

**Why:** The interactive prompt hangs the process indefinitely with no timeout.

**How to apply:** Prepend `CI=1` to the workflow command. Note: `--non-interactive` flag is not supported by this version of Expo CLI — use the env var instead. CI=1 also disables hot reload (Metro watch mode), which is acceptable for Replit.

## Final working workflow command

```
CI=1 RCT_METRO_PORT=5000 npx expo start --web --port 5000
```
