# Changelog

## 1.0.1 - Receipt Share Reliability + WaveSpeed Parser Fix

- Hardened Android receipt sharing so image handoff survives app launch timing, delayed project selection, and fallback intent paths.
- Improved Supabase receipt URL handling so WaveSpeed receives provider-readable image URLs.
- Made WaveSpeed/OpenRouter JSON parsing tolerate plain JSON, fenced JSON, prefixed JSON, content arrays, content objects, reasoning fields, and tool-call arguments.
- Added clearer AI error messages for invalid keys, model access, rate limits, timeouts, and unreachable receipt images.
- Built and signed release APK: `Ledge-release.apk`.
