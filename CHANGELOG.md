# Changelog

## 1.0.2 - WaveSpeed API Compatibility Update

- Added a Metro development proxy for WaveSpeed web-preview requests.
- Removed WaveSpeed `response_format` usage so Gemini models do not reject requests.
- Increased receipt-image response budget and disabled Gemini thinking for cleaner JSON replies.
- Preserved robust parsing for prefixed JSON, content objects, reasoning fields, and tool-call argument JSON.

## 1.0.1 - Receipt Share Reliability + WaveSpeed Parser Fix

- Hardened Android receipt sharing so image handoff survives app launch timing, delayed project selection, and fallback intent paths.
- Improved Supabase receipt URL handling so WaveSpeed receives provider-readable image URLs.
- Made WaveSpeed/OpenRouter JSON parsing tolerate plain JSON, fenced JSON, prefixed JSON, content arrays, content objects, reasoning fields, and tool-call arguments.
- Added clearer AI error messages for invalid keys, model access, rate limits, timeouts, and unreachable receipt images.
- Built and signed release APK: `Ledge-release.apk`.
