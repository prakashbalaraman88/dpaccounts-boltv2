// AI transaction analyzer — OpenRouter (OpenAI-compatible) edition.
//
// Strategy:
//   1. Text-only messages run through the local rule engine (parser.js)
//      first. High-confidence parses return instantly — no network, no
//      rate limits, works offline.
//   2. Ambiguous text and all receipt images go to OpenRouter using free
//      Gemma 4 vision models, with automatic fallback between models and
//      retry/backoff for the free tier's 429s.
//   3. If the LLM fails entirely, a lower-confidence local parse (when
//      available) is used so the user is never dead-blocked.
//
// The old Gemini service exposed analyzeMessage(apiKey, text, imageUri);
// this module keeps the exact same signature.

import { parseTransactionText } from './parser';
import { CATEGORIES } from '../constants/theme';

const BASE_URL = 'https://openrouter.ai/api/v1';

// Primary + fallbacks. All free, all support image input. The NVIDIA model
// rides a different upstream than the two Gemmas (Google AI Studio), so the
// chain survives provider-wide free-tier congestion.
export const MODEL_CHAIN = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
];

const MAX_ATTEMPTS_PER_MODEL = 2;
const TIMEOUT_MS = 45000;

// Confidence at or above which we trust the local parser and skip the LLM
const LOCAL_FAST_PATH_CONFIDENCE = 0.85;

const VALID_CATEGORY_IDS = new Set(
  [...CATEGORIES.incoming, ...CATEGORIES.expense].map((c) => c.id)
);

export const SYSTEM_PROMPT = `You are the transaction analyzer for "Ledge", an accounts app used by an Indian interior design business. Users send chat messages or receipt/bill images; you extract financial transactions.

RULES:
- Amounts are Indian Rupees. Convert Indian notations: "1 lakh"/"1L" = 100000, "2.5 lakh" = 250000, "1 crore"/"1cr" = 10000000, "50k" = 50000, "1,00,000" = 100000.
- INCOMING (money received by the business): "received", "got", "collected", "credited", "client paid", "advance from client", "refund received", hinglish "mila"/"aaya".
- EXPENSE (money paid out): "paid", "spent", "bought", "purchased", "given", "bill", "charges", hinglish "diya"/"kharcha".
- Extract the vendor/payee name when mentioned ("carpenter Raju" → vendor "Raju"; "from Shree Traders" → vendor "Shree Traders").
- Do NOT record pending/due/future/hypothetical amounts ("pending payment", "due", "balance remaining", "will pay", "quote", "estimate", "baki hai") — isTransaction is true ONLY for money that has already moved. "Cleared dues 12000" HAS moved (record it); "12000 dues pending" has NOT.
- For receipt/bill images: read the TOTAL/grand total (prefer the final payable amount incl. GST), the shop/vendor name, and the date if printed. A bill image is almost always an EXPENSE.
- PAYMENT APP SCREENSHOTS (GPay/PhonePe/Paytm/bank apps): determine direction ONLY from the words on screen. "Paid to", "Sent to", "Payment to", "Debited", "Money sent", a name with "To:" → EXPENSE (vendor = that name). "Received from", "Credited", "Money received", "Added to bank" → incoming. The user is an interior design business owner sharing their own payment screenshots — when a payment screenshot's direction is ambiguous, default to EXPENSE, never incoming.
- Pick category_id strictly from this list:
  incoming: current_account (bank/UPI/NEFT/online), savings_account, cash, cheque, others_incoming
  expense: measurements, designer_architect, construction_material (cement/plywood/tiles/paint/laminate/hardware shops), factory_materials, onsite_materials, jobwork (polish/installation/labour), carpenter, electrician, false_ceiling, operational (travel/fuel/food/office), others_expense

Respond with ONLY a valid JSON object, no markdown fences, in this exact shape:
{"isTransaction": true|false, "type": "incoming"|"expense", "amount": number, "description": "short description", "vendor": "name or empty string", "category_hint": "category_id", "reply": "only when isTransaction is false: short helpful reply"}

Examples:
"Received 1 lakh from client" → {"isTransaction": true, "type": "incoming", "amount": 100000, "description": "Payment received from client", "vendor": "", "category_hint": "current_account"}
"Paid 50k to carpenter Raju for wardrobe" → {"isTransaction": true, "type": "expense", "amount": 50000, "description": "Carpenter payment for wardrobe", "vendor": "Raju", "category_hint": "carpenter"}
"Plywood from Shree Traders 75,500 by UPI" → {"isTransaction": true, "type": "expense", "amount": 75500, "description": "Plywood purchase", "vendor": "Shree Traders", "category_hint": "construction_material"}
"Advance 2.5L aaya Mehta site ka" → {"isTransaction": true, "type": "incoming", "amount": 250000, "description": "Advance received for Mehta site", "vendor": "Mehta", "category_hint": "current_account"}
"hello" → {"isTransaction": false, "reply": "Hi! Send transaction details like 'Received ₹1,00,000 from client' or share a receipt image."}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractJson(rawText) {
  if (!rawText) return null;
  let text = String(rawText).trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/i, '').replace(/```\s*$/, '');
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

/** Normalize and validate whatever the model returned. */
function sanitizeResult(raw, source) {
  if (!raw || typeof raw !== 'object') return null;

  if (!raw.isTransaction) {
    return {
      isTransaction: false,
      reply:
        typeof raw.reply === 'string' && raw.reply.trim()
          ? raw.reply.trim()
          : "I couldn't detect a transaction. Try messages like 'Received ₹1,00,000' or 'Paid 50,000 to carpenter'.",
      source,
    };
  }

  const type = raw.type === 'incoming' ? 'incoming' : raw.type === 'expense' ? 'expense' : null;
  const amount = Number(raw.amount);
  if (!type || !isFinite(amount) || amount <= 0) return null;

  let category = typeof raw.category_hint === 'string' ? raw.category_hint.trim() : '';
  if (!VALID_CATEGORY_IDS.has(category)) {
    category = type === 'incoming' ? 'others_incoming' : 'others_expense';
  }
  // Guard against the model picking a category from the wrong side
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

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Image handling — convert any URI the app produces into a data URI
// ---------------------------------------------------------------------------

async function toDataUri(imageUri) {
  if (!imageUri) return null;
  if (imageUri.startsWith('data:')) return imageUri;

  // fetch() handles file:// (iOS), blob:// (web), https://; content:// is
  // converted to a cached file by the caller before reaching here.
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return `data:${mimeType};base64,${base64}`;
}

// ---------------------------------------------------------------------------
// OpenRouter call with model fallback + 429 backoff
// ---------------------------------------------------------------------------

async function queryOpenRouter(apiKey, messageText, imageDataUri) {
  const userContent = imageDataUri
    ? [
        { type: 'text', text: messageText },
        { type: 'image_url', image_url: { url: imageDataUri } },
      ]
    : messageText;

  let lastError = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const resp = await fetchWithTimeout(
          `${BASE_URL}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://ledge.app',
              'X-Title': 'Ledge InteriorBooks',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userContent },
              ],
              temperature: 0.1,
              max_tokens: 500,
            }),
          },
          TIMEOUT_MS
        );

        if (resp.status === 429) {
          // Free-tier saturation — brief backoff, then next attempt/model
          lastError = new Error('rate-limited (429)');
          await sleep(1500 * (attempt + 1));
          continue;
        }

        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          lastError = new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
          // 4xx other than 429 won't improve on retry with the same model
          if (resp.status >= 400 && resp.status < 500) break;
          continue;
        }

        const data = await resp.json();
        const message = data?.choices?.[0]?.message || {};
        // Some free providers return text under `reasoning` with empty content
        const rawText = message.content || message.reasoning || '';
        const parsed = extractJson(rawText);
        if (parsed) return { parsed, model };

        lastError = new Error(`unparseable response: ${String(rawText).slice(0, 120)}`);
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw lastError || new Error('OpenRouter query failed');
}

// ---------------------------------------------------------------------------
// Public API — same signature the screens already use
// ---------------------------------------------------------------------------

/**
 * Analyze a chat message (and optional receipt image) into a transaction.
 *
 * @param {string} apiKey   OpenRouter API key (sk-or-v1-...)
 * @param {string} messageText
 * @param {string|null} imageUri  data:/file:/https: URI of a receipt image
 */
export async function analyzeMessage(apiKey, messageText, imageUri = null) {
  const text = (messageText || '').trim();

  // 1) Local fast path for plain text
  const local = imageUri ? null : parseTransactionText(text);
  if (local && local.isTransaction && local.confidence >= LOCAL_FAST_PATH_CONFIDENCE) {
    return local;
  }

  // 2) LLM path (needed for images, used for ambiguous text)
  if (apiKey) {
    try {
      const imageDataUri = imageUri ? await toDataUri(imageUri) : null;
      const { parsed, model } = await queryOpenRouter(apiKey, text || 'Analyze this receipt/bill image and extract the transaction details.', imageDataUri);
      const sanitized = sanitizeResult(parsed, `openrouter:${model}`);
      if (sanitized) return sanitized;
    } catch (e) {
      console.warn('OpenRouter analysis failed:', e.message);
    }
  }

  // 3) Degrade gracefully: low-confidence local result beats nothing
  if (local && local.isTransaction) return local;

  if (imageUri) {
    return {
      isTransaction: false,
      reply: apiKey
        ? 'The AI service is busy right now (free-tier limit). Please try the image again in a minute, or type the amount as text.'
        : 'Receipt image analysis needs an OpenRouter API key — ask your admin to set it in Settings.',
      source: 'fallback',
    };
  }

  return {
    isTransaction: false,
    reply:
      local && local.confidence < 0.5
        ? 'I can see numbers but not whether money came in or went out. Try "Received 50,000 from client" or "Paid 50,000 to vendor".'
        : "I couldn't detect a transaction. Try 'Received ₹1,00,000 from client' or 'Paid 50,000 to carpenter Raju'.",
    source: 'fallback',
  };
}
