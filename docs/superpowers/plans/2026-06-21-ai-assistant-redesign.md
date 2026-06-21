# AI Assistant Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OpenRouter with NVIDIA NIM, make the AI a friendly full assistant, and add a push-to-talk Talk tab.

**Architecture:** Client-side NVIDIA NIM calls from the app; `meta/llama-3.1-8b-instruct` for text, `minimaxai/minimax-m3` for receipt images. AI returns transaction/reply/action modes. Talk tab uses `expo-speech-recognition` for on-device transcription.

**Tech Stack:** React Native (Expo SDK 55), Zustand, NVIDIA NIM OpenAI-compatible API, `expo-speech-recognition`.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/services/ai.js` | NVIDIA NIM client; text + vision endpoints; transaction/reply/action response parsing. |
| `src/services/parser.js` | Local fast-path parser; fallback when NIM fails. |
| `src/utils/haptics.js` | Existing haptics utility; extend with recording pulse. |
| `app/project/[id].js` | Project chat; calls assistant, renders reply/action/transaction cards. |
| `app/talk.js` | New push-to-talk voice screen. |
| `app/_layout.js` | Add Talk tab to navigation. |
| `app/settings.js` | Update API key input label to NVIDIA NIM. |
| `src/stores/appStore.js` | Already stores `aiApiKey`; no change needed. |
| `.env` | Add `EXPO_PUBLIC_NVIDIA_NIM_API_KEY`. |

---

## Task 1: Configure NVIDIA NIM environment

**Files:**
- Modify: `InteriorBooks/.env`
- Modify: `InteriorBooks/app.json` (optional, for extra env hint)

- [ ] **Step 1: Add NVIDIA NIM key to `.env`**

```bash
# InteriorBooks/.env
EXPO_PUBLIC_NVIDIA_NIM_API_KEY=nvapi-...
```

- [ ] **Step 2: Verify the app already reads it**

`src/stores/appStore.js` uses `process.env.EXPO_PUBLIC_OPENROUTER_API_KEY` today. Change the fallback name to `EXPO_PUBLIC_NVIDIA_NIM_API_KEY`.

```js
const DEFAULT_AI_KEY = process.env.EXPO_PUBLIC_NVIDIA_NIM_API_KEY || '';
```

- [ ] **Step 3: Commit**

```bash
git add InteriorBooks/.env InteriorBooks/src/stores/appStore.js
git commit -m "chore: switch env key to NVIDIA NIM"
```

---

## Task 2: Refactor `src/services/ai.js` for NVIDIA NIM

**Files:**
- Modify: `src/services/ai.js`

- [ ] **Step 1: Replace base URL and model chain**

```js
const BASE_URL = 'https://integrate.api.nvidia.com/v1';

const TEXT_MODEL = 'meta/llama-3.1-8b-instruct';
const TEXT_FALLBACK_MODEL = 'meta/llama-3.1-70b-instruct';
const VISION_MODEL = 'minimaxai/minimax-m3';
```

- [ ] **Step 2: Replace `SYSTEM_PROMPT` with assistant prompt**

```js
export const SYSTEM_PROMPT = `You are "Ledge", a friendly, helpful accounting assistant for an Indian interior design business.

Your job:
- Help the user with accounting, project tracking, expenses, income, and business questions.
- When the user describes a financial transaction, extract it and reply with JSON only.
- When the user asks a question or wants help, reply naturally and helpfully.
- When the user wants you to do something in the app (create project, add transaction, show report), reply with a structured action.

Transaction JSON shape (use ONLY for actual money movements):
{"isTransaction": true, "type": "incoming"|"expense", "amount": number, "description": "short description", "vendor": "name or empty", "category_hint": "category_id"}

Action JSON shape (use when user wants you to perform an app action):
{"isTransaction": false, "action": "createProject|addTransaction|showReport|searchTransactions|summarizeProject", "args": {...}}

Reply JSON shape (use for normal conversation, answers, questions):
{"isTransaction": false, "reply": "your friendly helpful response"}

Category IDs for transactions:
incoming: current_account, savings_account, cash, cheque, others_incoming
expense: measurements, designer_architect, construction_material, factory_materials, onsite_materials, jobwork, carpenter, electrician, false_ceiling, operational, others_expense

Indian amount rules:
- 1 lakh / 1L = 100000
- 1 crore / 1cr = 10000000
- 50k = 50000
- 1,00,000 = 100000

Always respond with exactly one valid JSON object. No markdown fences, no extra text.`;
```

- [ ] **Step 3: Replace `queryOpenRouter` with `queryNimText` and `queryNimVision`**

```js
async function queryNimText(apiKey, messages, timeoutMs = 20000) {
  for (const model of [TEXT_MODEL, TEXT_FALLBACK_MODEL]) {
    try {
      const resp = await fetchWithTimeout(
        `${BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: 600,
          }),
        },
        timeoutMs
      );

      if (resp.status === 429) {
        await sleep(1500);
        continue;
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }

      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content || '';
      const parsed = extractJson(text);
      if (parsed) return { parsed, model };
    } catch (e) {
      console.warn(`NIM text model ${model} failed:`, e.message);
    }
  }
  throw new Error('NIM text query failed');
}

async function queryNimVision(apiKey, messages, timeoutMs = 25000) {
  const resp = await fetchWithTimeout(
    `${BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages,
        temperature: 0.1,
        max_tokens: 400,
      }),
    },
    timeoutMs
  );

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(text);
  if (!parsed) throw new Error('Unparseable vision response');
  return { parsed, model: VISION_MODEL };
}
```

- [ ] **Step 4: Replace `analyzeMessage` with `assistantChat`**

```js
export async function assistantChat(apiKey, messageText, imageUri = null) {
  const text = (messageText || '').trim();

  // Local fast path for confident text transactions
  if (!imageUri && text) {
    const local = parseTransactionText(text);
    if (local && local.isTransaction && local.confidence >= LOCAL_FAST_PATH_CONFIDENCE) {
      return sanitizeResult({ ...local, source: 'local' }, 'local');
    }
  }

  if (apiKey) {
    try {
      const systemMessage = { role: 'system', content: SYSTEM_PROMPT };
      const userContent = imageUri
        ? [
            { type: 'text', text: text || 'Analyze this receipt or payment screenshot.' },
            { type: 'image_url', image_url: { url: await toDataUri(imageUri) } },
          ]
        : text;
      const messages = [systemMessage, { role: 'user', content: userContent }];

      const { parsed } = imageUri
        ? await queryNimVision(apiKey, messages)
        : await queryNimText(apiKey, messages);

      const sanitized = sanitizeResult(parsed, imageUri ? `nim:vision:${VISION_MODEL}` : `nim:text:${TEXT_MODEL}`);
      if (sanitized) return sanitized;
    } catch (e) {
      console.warn('NIM assistant failed:', e.message);
    }
  }

  // Fallback: low-confidence local parse
  if (!imageUri && text) {
    const local = parseTransactionText(text);
    if (local && local.isTransaction) return sanitizeResult({ ...local, source: 'local' }, 'local');
  }

  return {
    isTransaction: false,
    reply: apiKey
      ? 'I\'m having trouble understanding that. Try rephrasing, or share a receipt image.'
      : 'AI assistant needs a NVIDIA NIM API key. Ask your admin to set it in Settings.',
    source: 'fallback',
  };
}
```

- [ ] **Step 5: Update exports and remove old `analyzeMessage`**

Ensure the file exports `assistantChat`, `SYSTEM_PROMPT`, and keeps helpers internal.

- [ ] **Step 6: Run a quick import check**

```bash
cd InteriorBooks && node --check src/services/ai.js
```

Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add InteriorBooks/src/services/ai.js InteriorBooks/src/stores/appStore.js
git commit -m "feat(ai): switch to NVIDIA NIM with assistant modes"
```

---

## Task 3: Update `sanitizeResult` to support action mode

**Files:**
- Modify: `src/services/ai.js`

- [ ] **Step 1: Extend `sanitizeResult`**

```js
export const VALID_ACTIONS = new Set([
  'createProject',
  'addTransaction',
  'showReport',
  'searchTransactions',
  'summarizeProject',
]);

function sanitizeResult(raw, source) {
  if (!raw || typeof raw !== 'object') return null;

  // Non-transaction modes: reply or action
  if (!raw.isTransaction) {
    if (raw.action && VALID_ACTIONS.has(raw.action)) {
      return {
        isTransaction: false,
        action: raw.action,
        args: raw.args && typeof raw.args === 'object' ? raw.args : {},
        source,
      };
    }
    return {
      isTransaction: false,
      reply:
        typeof raw.reply === 'string' && raw.reply.trim()
          ? raw.reply.trim()
          : "I'm here to help with your accounting. Try asking about a project, expense, or say 'create project for Mehta'.",
      source,
    };
  }

  // Transaction mode (same as before)
  const type = raw.type === 'incoming' ? 'incoming' : raw.type === 'expense' ? 'expense' : null;
  const amount = Number(raw.amount);
  if (!type || !isFinite(amount) || amount <= 0) return null;

  let category = typeof raw.category_hint === 'string' ? raw.category_hint.trim() : '';
  if (!VALID_CATEGORY_IDS.has(category)) {
    category = type === 'incoming' ? 'others_incoming' : 'others_expense';
  }
  const sideIds = new Set(CATEGORIES[type].map((c) => c.id));
  if (!sideIds.has(category)) {
    category = type === 'incoming' ? 'others_incoming' : 'others_expense';
  }

  return {
    isTransaction: true,
    type,
    amount: Math.round(amount * 100) / 100,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 200) : '',
    vendor: typeof raw.vendor === 'string' ? raw.vendor.slice(0, 80) : '',
    category_hint: category,
    source,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add InteriorBooks/src/services/ai.js
git commit -m "feat(ai): support action responses"
```

---

## Task 4: Update project chat to use assistant responses

**Files:**
- Modify: `app/project/[id].js`

- [ ] **Step 1: Update imports**

```js
import { assistantChat } from '../../src/services/ai';
```

- [ ] **Step 2: Replace `processWithAI` body**

Locate the existing `processWithAI` function. Keep its signature but replace the call:

```js
const result = await assistantChat(aiApiKey, content, imageUri);
```

- [ ] **Step 3: Handle reply mode**

After receiving `result`, add a branch:

```js
if (!result.isTransaction) {
  if (result.action) {
    await handleAssistantAction(result.action, result.args);
  }
  await addMessage(projectId, 'text', result.reply || 'Done.', null, 'bot');
  setIsSending(false);
  return;
}
```

- [ ] **Step 4: Add `handleAssistantAction` method**

```js
const handleAssistantAction = async (action, args) => {
  switch (action) {
    case 'createProject':
      router.push({ pathname: '/', params: { openCreate: 'true', ...args } });
      break;
    case 'addTransaction':
      setTransactionForm({
        type: args.type || 'expense',
        amount: String(args.amount || ''),
        description: args.description || '',
        vendor: args.vendor || '',
        category: args.category_hint || '',
      });
      setModalVisible(true);
      break;
    case 'showReport':
      router.push('/dashboard');
      break;
    case 'searchTransactions':
      // Filter local messages by query; show a system message
      await addMessage(projectId, 'text', `Searching for "${args.query}"...`, null, 'bot');
      break;
    case 'summarizeProject':
      const totals = currentProject;
      const bal = (totals?.total_incoming || 0) - (totals?.total_expense || 0);
      await addMessage(
        projectId,
        'text',
        `Project summary: Income ₹${totals?.total_incoming || 0}, Expense ₹${totals?.total_expense || 0}, Balance ₹${bal}.`,
        null,
        'bot'
      );
      break;
  }
};
```

- [ ] **Step 5: Verify syntax**

```bash
cd InteriorBooks && node --check app/project/\[id\].js
```

- [ ] **Step 6: Commit**

```bash
git add InteriorBooks/app/project/\[id\].js
git commit -m "feat(chat): handle assistant reply/action modes"
```

---

## Task 5: Install speech recognition

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install package**

```bash
cd InteriorBooks && npx expo install expo-speech-recognition
```

- [ ] **Step 2: Add Android permission to `app.json`**

```json
"android": {
  "permissions": [
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_MEDIA_IMAGES"
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add InteriorBooks/package.json InteriorBooks/package-lock.json InteriorBooks/app.json
# also add android/app/src/main/AndroidManifest.xml if expo plugin changed it
git commit -m "deps: add expo-speech-recognition"
```

---

## Task 6: Create Talk tab screen

**Files:**
- Create: `app/talk.js`

- [ ] **Step 1: Create `app/talk.js`**

```jsx
import { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SpeechRecognition from 'expo-speech-recognition';
import { useAppStore } from '../src/stores/appStore';
import { assistantChat } from '../src/services/ai';
import { theme } from '../src/constants/theme';
import { impactLight, impactMedium } from '../src/utils/haptics';

export default function TalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aiApiKey } = useAppStore();
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef(null);

  const startRecording = useCallback(async () => {
    const { status } = await SpeechRecognition.requestPermissionsAsync();
    if (status !== 'granted') return;

    impactMedium();
    setIsRecording(true);
    setTranscript('');

    await SpeechRecognition.startAsync({
      lang: 'en-IN',
      partialResults: true,
      interimResults: true,
    });
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    impactLight();

    try {
      const result = await SpeechRecognition.stopAsync();
      const text = result?.transcript || transcript;
      if (!text.trim()) return;
      await sendMessage(text.trim());
    } catch (e) {
      console.warn('Speech stop error:', e);
    }
  }, [transcript]);

  const sendMessage = async (text) => {
    setMessages((m) => [...m, { role: 'user', text }]);
    setIsSending(true);
    try {
      const reply = await assistantChat(aiApiKey, text);
      setMessages((m) => [...m, { role: 'bot', ...reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setIsSending(false);
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(12, insets.top + 8), paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Talk to Ledge</Text>
        <Text style={styles.headerSubtitle}>Hold the mic and speak</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={styles.bubbleText}>{m.text || m.reply || `[${m.action}]`}</Text>
          </View>
        ))}
        {isSending && <Text style={styles.thinking}>Ledge is thinking...</Text>}
      </ScrollView>

      <View style={styles.micWrap}>
        {transcript ? <Text style={styles.transcript}>{transcript}</Text> : null}
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          style={[styles.micButton, isRecording && styles.micButtonActive]}
        >
          <IconButton icon="microphone" iconColor={theme.colors.onPrimary} size={40} style={{ margin: 0 }} />
        </Pressable>
        <Text style={styles.micHint}>{isRecording ? 'Listening...' : 'Hold to talk'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.onSurface },
  headerSubtitle: { fontSize: 14, color: theme.colors.secondary, marginTop: 4 },
  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 16 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginVertical: 6 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.primaryContainer },
  botBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surface },
  bubbleText: { color: theme.colors.onSurface, fontSize: 15 },
  thinking: { alignSelf: 'flex-start', color: theme.colors.secondary, marginLeft: 16, marginTop: 8 },
  micWrap: { alignItems: 'center', paddingVertical: 24 },
  transcript: { color: theme.colors.secondary, marginBottom: 12, fontSize: 14 },
  micButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  micButtonActive: { backgroundColor: theme.colors.expense, transform: [{ scale: 1.05 }] },
  micHint: { color: theme.colors.secondary, marginTop: 12, fontSize: 14 },
});
```

- [ ] **Step 2: Verify syntax**

```bash
cd InteriorBooks && node --check app/talk.js
```

- [ ] **Step 3: Commit**

```bash
git add InteriorBooks/app/talk.js
git commit -m "feat(talk): add push-to-talk assistant screen"
```

---

## Task 7: Add Talk tab to navigation

**Files:**
- Modify: `app/_layout.js`

- [ ] **Step 1: Add tab route**

If the project uses a tab navigator, add a `talk` tab. If it uses a custom layout, add the route. For a simple bottom-tabs setup with expo-router:

```jsx
<Tabs>
  <Tabs.Screen name="index" options={{ title: 'Home' }} />
  <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
  <Tabs.Screen name="talk" options={{ title: 'Talk', tabBarIcon: ({ color }) => <MaterialIcons name="mic" color={color} size={24} /> }} />
  <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
</Tabs>
```

If there is no tab navigator, add a simple icon button in the home header that routes to `/talk`:

```jsx
<IconButton icon="microphone" onPress={() => router.push('/talk')} />
```

- [ ] **Step 2: Commit**

```bash
git add InteriorBooks/app/_layout.js
git commit -m "feat(nav): add Talk tab"
```

---

## Task 8: Update Settings screen for NVIDIA NIM

**Files:**
- Modify: `app/settings.js`

- [ ] **Step 1: Update labels**

Find the OpenRouter key section and update text:

```jsx
<Text>OpenRouter API Key</Text>
```
to

```jsx
<Text>NVIDIA NIM API Key</Text>
```

Update helper text and link:

```jsx
onPress={() => Linking.openURL('https://build.nvidia.com/nim')}
```

- [ ] **Step 2: Commit**

```bash
git add InteriorBooks/app/settings.js
git commit -m "ui(settings): rebrand AI key section for NVIDIA NIM"
```

---

## Task 9: Validate parser eval still passes

**Files:**
- None (verification)

- [ ] **Step 1: Run parser eval**

```bash
cd InteriorBooks && node scripts/eval-parser.mjs
```

Expected: 100% pass on all metrics.

- [ ] **Step 2: Run TypeScript check**

```bash
cd InteriorBooks && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit any fixes**

If errors appear, fix and commit.

---

## Task 10: Build release APK

**Files:**
- None (build artifact)

- [ ] **Step 1: Build release APK**

```bash
cd InteriorBooks/android
export JAVA_HOME="$(pwd)/../tools/jdk-17"
export ANDROID_HOME="d:\AndroidSdk"
export GRADLE_USER_HOME="d:\gradlehome"
./gradlew assembleRelease --no-daemon --console=plain
```

- [ ] **Step 2: Copy APK to Desktop**

```bash
cp app/build/outputs/apk/release/app-release.apk "/c/Users/Prakash Other/Desktop/Ledge-release.apk"
```

- [ ] **Step 3: Report file path and size**

```bash
ls -lh "/c/Users/Prakash Other/Desktop/Ledge-release.apk"
```

---

## Testing checklist

- [ ] Text transaction: "Paid 5000 to carpenter Raju" → extracted as expense.
- [ ] General question: "What is my total expense this month?" → friendly reply.
- [ ] Action: "Create project for Mehta at JP Nagar" → triggers create project flow.
- [ ] Receipt image → correct vendor/amount/category.
- [ ] Talk tab: hold mic, speak, release → transcript appears and AI replies.
- [ ] No OpenRouter calls remain in codebase.
