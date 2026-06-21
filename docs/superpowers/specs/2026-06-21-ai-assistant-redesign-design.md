# AI Assistant Redesign — Design Spec

**Date:** 2026-06-21  
**Project:** Ledge (InteriorBooks)  
**Status:** Approved for implementation planning  

## 1. Goal

Transform the current transaction-only AI into a friendly, helpful in-app assistant that:
- Answers accounting and business questions naturally.
- Still extracts transactions from text and receipt images.
- Can trigger app actions (create project, add transaction, show reports) via structured responses.
- Adds a "Talk" tab with push-to-talk voice dictation.
- Replaces OpenRouter with NVIDIA NIM for cost/performance reasons.

## 2. Current State

- `src/services/ai.js` calls OpenRouter directly from the app.
- Model chain: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-nano-12b-v2-vl:free`.
- `analyzeMessage(apiKey, text, imageUri)` returns either a transaction JSON or a fallback rejection reply.
- The app treats any non-transaction as a rejection, which feels like the AI "says no" to everything.
- There is no backend AI service; the Supabase edge function only creates users.

## 3. Proposed Architecture (Option A — Client-side NVIDIA NIM)

Keep AI calls inside the app. Replace OpenRouter with NVIDIA NIM OpenAI-compatible endpoints.

### 3.1 Model Strategy

| Use case | Model | Rationale |
|----------|-------|-----------|
| Text chat, questions, transaction extraction | `meta/llama-3.1-8b-instruct` | 0.5s latency, ~150 tokens, cheapest for high-volume text. |
| Receipt / payment screenshots | `minimaxai/minimax-m3` | 3.9s latency, only 268 prompt tokens for a test receipt (vs 2,852 for Nemotron VL), good OCR. |

Fallback chain for each modality if a model returns 404/429/failure:
- Text: Llama 3.1 8B → Llama 3.1 70B → local parser.
- Vision: miniMax-M3 → Nemotron nano VL (if needed) → manual fallback message.

### 3.2 API Endpoint

- Base URL: `https://integrate.api.nvidia.com/v1/chat/completions`
- Auth: Bearer token from `EXPO_PUBLIC_NVIDIA_NIM_API_KEY` (overridable in Settings).
- Same `fetchWithTimeout` + retry/backoff pattern already used for OpenRouter.

### 3.3 Response Modes

The assistant returns one of three response types:

1. **transaction** — structured transaction JSON, same shape as today:
   ```json
   {"isTransaction": true, "type": "incoming|expense", "amount": 5000, "description": "...", "vendor": "...", "category_hint": "..."}
   ```

2. **reply** — friendly natural-language answer for questions, help, small talk.
   ```json
   {"isTransaction": false, "reply": "Your total expense this month is ₹1,25,000."}
   ```

3. **action** — structured intent for the app to execute.
   ```json
   {"isTransaction": false, "action": "createProject", "args": {"client_name": "Mehta", "project_name": "JP Nagar 2BHK"}}
   ```

The system prompt instructs the model when to use each mode.

### 3.4 Supported Actions (MVP)

| Action | Args | App behavior |
|--------|------|--------------|
| `createProject` | `client_name`, `project_name`, `location?`, `budget?` | Open project creation modal pre-filled. |
| `addTransaction` | `type`, `amount`, `description`, `vendor?`, `category_hint?`, `project_id?` | Open transaction entry modal pre-filled. |
| `showReport` | `report_type`, `project_id?`, `date_range?` | Navigate to dashboard/report view with filters. |
| `searchTransactions` | `query` | Show matching transactions in the current project or globally. |
| `summarizeProject` | `project_id` | Show a summary card of income/expense/balance for the project. |

Actions are handled by the calling screen; the AI does not mutate state directly.

## 4. Talk Tab (Wispr Flow-style)

### 4.1 Interaction

- New bottom-tab screen: **Talk**.
- Large circular microphone button in the center.
- **Push-to-hold**: user holds the button, speaks, releases to send.
- Real-time waveform animation while recording.
- Transcribed text appears above the button before sending.
- Optional: haptic feedback on start/stop.

### 4.2 Voice-to-text

NVIDIA NIM does not provide speech recognition. Use on-device transcription to avoid extra API cost:
- Library: `expo-speech-recognition` (preferred) or `react-native-voice`.
- Android/iOS native speech recognition.
- Transcribed text is then passed to the same `assistantChat` function.

### 4.3 Privacy

Audio never leaves the device; only the final transcribed text is sent to NVIDIA NIM.

## 5. UI/UX Changes

### 5.1 Project Chat Screen (`app/project/[id].js`)

- Keep existing transaction-entry UI.
- Treat AI responses as chat bubbles.
- If response is a transaction, show a confirmation card: "Add this transaction?" with category selection.
- If response is an action, show a clickable action card.
- If response is a reply, render as a normal chat bubble.

### 5.2 New Assistant / Talk Screen

- Route: `app/talk.js`.
- Full-screen dark UI with centered mic.
- Recent assistant messages shown above the mic.
- Tab icon: microphone.

### 5.3 Navigation

Add a bottom tab for Talk alongside existing tabs (Home, Projects, Settings, etc.).

## 6. Data Flow

```
User input (text or transcribed voice)
        ↓
[Text?] → meta/llama-3.1-8b-instruct
[Image?] → minimaxai/minimax-m3
        ↓
Parse response → transaction / reply / action
        ↓
Render in chat OR execute action OR save transaction
```

## 7. Key Files to Modify / Create

| File | Change |
|------|--------|
| `src/services/ai.js` | Replace OpenRouter with NVIDIA NIM; split into text/vision paths; add reply/action modes; update system prompt. |
| `src/services/parser.js` | Keep as fast-path fallback; ensure it returns `source: 'local'`. |
| `src/utils/haptics.js` | Already exists; add recording pulse helper. |
| `app/project/[id].js` | Update `processWithAI` to handle reply/action/transaction responses. |
| `app/talk.js` | New push-to-talk screen. |
| `app/_layout.js` or navigation config | Add Talk tab. |
| `app/settings.js` | Update API key label from OpenRouter to NVIDIA NIM. |
| `.env` / `app.json` | Add `EXPO_PUBLIC_NVIDIA_NIM_API_KEY`. |
| `package.json` | Add `expo-speech-recognition` (or equivalent). |

## 8. Error Handling

- **Rate limit (429):** Back off and retry once; if still failing, show friendly message: *"AI is busy, please try again in a moment."*
- **Credit exhausted (402):** Show admin message: *"NVIDIA NIM credits exhausted. Contact admin to add a key."*
- **Timeout:** Fall back to local parser for text; for images, ask user to type amount.
- **No API key:** Disable AI features and show setup prompt.

## 9. Cost Considerations

- NVIDIA NIM free tier: ~40 RPM, 1,000–5,000 credits (prototyping only).
- For internal employee use with low volume, free tier is viable.
- miniMax-M3 image tokens are ~10× cheaper than Nemotron VL for the same receipt.
- Production use requires NVIDIA AI Enterprise license.

## 10. Success Criteria

- AI responds helpfully to non-transaction questions.
- Receipt images still extract correct vendor/amount/category.
- Push-to-talk transcribes and sends text successfully.
- Actions (create project, add transaction, show report) are triggered correctly.
- No OpenRouter calls remain in the codebase.

## 11. Out of Scope (for this phase)

- Backend AI service / Supabase Edge Function AI proxy.
- Real-time streaming responses.
- Voice synthesis (AI talking back).
- Multi-turn memory beyond the current chat session.
