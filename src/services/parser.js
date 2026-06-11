// Deterministic transaction parser for Indian-accounting chat messages.
//
// This is the first line of analysis: it handles the common phrasings
// ("Paid 50k to carpenter Raju", "Received 1.5 lakh advance from client")
// without any network call, so the app stays fast and works even when the
// free LLM tier is rate-limited. Messages it can't confidently parse fall
// through to the OpenRouter model in ai.js.
//
// Pure JS, no React Native imports — runnable in Node for the eval suite
// (scripts/eval-parser.mjs). Tuned against scripts/eval-dataset.json.

// ---------------------------------------------------------------------------
// Amount parsing
// ---------------------------------------------------------------------------

// Matches: 1,00,000 | 100000 | 1.5 | ₹2,500 | Rs. 500
const NUM = '(?:\\d{1,3}(?:,\\d{2,3})+|\\d+)(?:\\.\\d+)?';

// Unit multipliers commonly used in Indian business speech
const UNITS = [
  { re: /^(?:crores?|cr)$/i, mult: 10000000 },
  { re: /^(?:lakhs?|lacs?|lakh|lac|l)$/i, mult: 100000 },
  { re: /^(?:thousands?|k)$/i, mult: 1000 },
];

const AMOUNT_RE = new RegExp(
  `(?:₹|rs\\.?|inr|rupees?)?\\s*(${NUM})\\s*(crores?|cr|lakhs?|lacs?|lakh|lac|thousands?|k|l)?\\b\\.?`,
  'gi'
);

// Numbers right after these words are identifiers, not amounts.
// Hard refs block on the bare keyword ("cheque 445566"); soft refs only
// block with an explicit no./number/# marker ("bill no 123" blocks, but
// "bill 4,300 paid" is a real amount).
const HARD_REF_RE =
  /(?:cheque|chq|check|dd|ref(?:erence)?|utr|txn|transaction|a\/?c|mob(?:ile)?|phone|no\.|#)\s*(?:no\.?|num(?:ber)?|id)?\s*[:#-]?\s*$/i;
const SOFT_REF_RE =
  /(?:invoice|order|bill|receipt|flat|plot|account|gst(?:in)?)\s*(?:no\.?|num(?:ber)?|id|#)\s*[:#-]?\s*$/i;

const INDIAN_COMMA_RE = /^\d{1,3}(?:,\d{2,3})+/;

function toNumber(numStr) {
  return parseFloat(numStr.replace(/,/g, ''));
}

function unitMultiplier(unitStr) {
  if (!unitStr) return 1;
  for (const { re, mult } of UNITS) {
    if (re.test(unitStr)) return mult;
  }
  return 1;
}

/**
 * Extract the most plausible transaction amount from free text.
 * Returns { amount, hadCurrencyHint } or null.
 */
export function extractAmount(text) {
  const candidates = [];
  let m;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(text)) !== null) {
    const raw = m[0];
    const value = toNumber(m[1]) * unitMultiplier(m[2]);
    if (!isFinite(value) || value <= 0) continue;

    const digitsOnly = m[1].replace(/[.,]/g, '');
    const after = text.slice(m.index + raw.length, m.index + raw.length + 1);
    const before = text.slice(Math.max(0, m.index - 24), m.index);

    // Skip: percentages, reference/cheque/phone-style identifiers
    if (after === '%') continue;
    if (HARD_REF_RE.test(before) || SOFT_REF_RE.test(before)) continue;
    if (!m[2] && /^[6-9]\d{9}$/.test(digitsOnly)) continue; // mobile number
    if (!m[2] && /^(19|20)\d{2}$/.test(digitsOnly) && value >= 1900 && value <= 2099) {
      // Probably a year unless prefixed with currency
      if (!/₹|rs|inr|rupee/i.test(raw)) continue;
    }

    const hadCurrencyHint =
      /₹|rs|inr|rupee/i.test(raw) ||
      Boolean(m[2]) ||
      INDIAN_COMMA_RE.test(m[1]); // 1,00,000-style grouping is a strong money cue

    candidates.push({ amount: value, hadCurrencyHint, index: m.index });
  }

  if (candidates.length === 0) return null;
  // Prefer candidates with explicit money cues, then the largest value
  candidates.sort(
    (a, b) => (b.hadCurrencyHint - a.hadCurrencyHint) || (b.amount - a.amount)
  );
  return candidates[0];
}

// ---------------------------------------------------------------------------
// Direction (incoming vs expense)
// ---------------------------------------------------------------------------

// "client/customer <verb>" means money came IN even though the verb alone
// ("paid", "gave", "sent", "transferred") normally signals an expense.
const SUBJECT_INCOMING_RE =
  /\b(?:client|customer|party)\s+(?:has\s+)?(?:paid|gave|given|sent|transferred|deposited)\b/i;

const INCOMING_PATTERNS = [
  /\breceived?\b/i, /\brecieved?\b/i, /\bgot\b/i, /\bcollected\b/i,
  /\bcredited\b/i, /\bpayment\s+(?:received|from)\b/i,
  /\bincoming\b/i, /\bincome\b/i,
  /\bmila\b/i, /\bmile\b/i, /\baaya\b/i, /\baaye\b/i, // hinglish: received/came
  /\brefund(?:ed)?\b/i,
  /\bdeposit(?:ed)?\s+(?:by|received)\b/i, /\bdeposit\s+received\b/i,
];

const EXPENSE_PATTERNS = [
  /\bpaid\b/i, /\bpay\b/i, /\bspent\b/i, /\bspend\b/i, /\bbought\b/i, /\bbuy\b/i,
  /\bpurchased?\b/i, /\bgiven?\b/i, /\bgave\b/i, /\bcost(?:ed)?\b/i,
  /\bdebited\b/i, /\bexpenses?\b/i, /\bbill\s+(?:of|paid|amount)\b/i,
  /\bcharges?\b/i, /\bfees?\s+(?:paid|of)\b/i,
  /\b(?:labour|labor|wages?|salary|staff)\s+payment\b/i,
  /\bpayment\s+(?:to|for|made)\b/i,
  /\bsalary\b/i, /\bwages?\b/i,
  /\bdiya\b/i, /\bdiye\b/i, /\bkharcha\b/i, /\bkharch\b/i, // hinglish: gave/expense
  /\binvoice\s+paid\b/i, /\bsettled\b/i, /\btransferr?ed\b/i,
  /\bsent\b/i,
];

// Generic verbs that the subject-incoming rule "consumes"
const SUBJECT_CONSUMED_EXPENSE = [/\bpaid\b/i, /\bgave\b/i, /\bgiven?\b/i, /\bsent\b/i, /\btransferr?ed\b/i, /\bdeposited\b/i];

function detectType(text) {
  let incomingScore = 0;
  let expenseScore = 0;
  for (const re of INCOMING_PATTERNS) if (re.test(text)) incomingScore++;
  for (const re of EXPENSE_PATTERNS) if (re.test(text)) expenseScore++;

  // Subject-aware override: "client paid us" is incoming
  if (SUBJECT_INCOMING_RE.test(text)) {
    incomingScore += 2;
    for (const re of SUBJECT_CONSUMED_EXPENSE) {
      if (re.test(text)) expenseScore = Math.max(0, expenseScore - 1);
    }
  }

  // "advance" alone (no other verbs) usually means a client advance received
  if (/\badvance\b/i.test(text) && incomingScore === 0 && expenseScore === 0) {
    incomingScore++;
  }

  if (incomingScore === 0 && expenseScore === 0) return { type: null, tieBroken: false };
  if (incomingScore === expenseScore) {
    // Tie-break: "from X" suggests incoming, "to X" suggests expense
    const hasFrom = /\bfrom\s+\w/i.test(text);
    const hasTo = /\bto\s+\w/i.test(text);
    if (hasFrom && !hasTo) return { type: 'incoming', tieBroken: true };
    if (hasTo && !hasFrom) return { type: 'expense', tieBroken: true };
    return { type: null, tieBroken: false };
  }
  return {
    type: incomingScore > expenseScore ? 'incoming' : 'expense',
    tieBroken: false,
  };
}

// ---------------------------------------------------------------------------
// Vendor / payee extraction
// ---------------------------------------------------------------------------

// Words that follow to/from but are not vendor names
const NON_VENDOR_WORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'his', 'her', 'their', 'me', 'us', 'him', 'them',
  'bank', 'account', 'cash', 'cheque', 'check', 'upi', 'gpay', 'phonepe', 'paytm',
  'site', 'office', 'shop', 'market', 'today', 'yesterday', 'tomorrow',
  'client', 'customer', 'party', 'advance', 'and', 'for', 'via', 'by',
  'current', 'savings', 'neft', 'rtgs', 'imps', 'online',
]);

const ROLE_WORDS = [
  'carpenter', 'electrician', 'plumber', 'painter', 'designer', 'architect',
  'contractor', 'mason', 'fabricator', 'welder', 'polisher', 'labour', 'labor',
  'supplier', 'vendor', 'dealer', 'driver', 'helper', 'mistry', 'mistri', 'thekedar',
];

function cleanName(raw) {
  if (!raw) return '';
  let name = raw
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+(for|via|by|on|at|in|of|and|&)\s+.*$/i, '')
    .trim();
  // Cap at 4 words — vendor names are short
  name = name.split(/\s+/).slice(0, 4).join(' ');
  return name.trim();
}

function isPlausibleName(name) {
  if (!name || name.length < 2) return false;
  const lower = name.toLowerCase();
  if (NON_VENDOR_WORDS.has(lower)) return false;
  if (ROLE_WORDS.includes(lower)) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

/**
 * Pull a vendor / payee name out of phrases like:
 *  "to carpenter Raju" → Raju ; "from Shree Traders" → Shree Traders
 *  "settled with Crystal Glass House" → Crystal Glass House
 */
export function extractVendor(text, type) {
  // Pattern 1: role word followed by a capitalized name ("carpenter Raju")
  const roleRe = new RegExp(
    `\\b(?:${ROLE_WORDS.join('|')})\\s+([A-Z][\\w]+(?:\\s+[A-Z][\\w]+)?)`,
    ''
  );
  const roleMatch = text.match(roleRe);
  if (roleMatch) {
    const name = cleanName(roleMatch[1]);
    if (isPlausibleName(name)) return name;
  }

  // Pattern 2: "to/from/with <Name>" — capitalized multi-word names first
  const preps = type === 'incoming' ? ['from', 'by'] : ['to', 'with', 'from', 'by'];
  for (const prep of preps) {
    const capRe = new RegExp(`\\b${prep}\\s+((?:[A-Z][\\w&.']*\\s*){1,4})`, '');
    const m = text.match(capRe);
    if (m) {
      const name = cleanName(m[1]);
      if (isPlausibleName(name) && !/^(Received|Paid|Got)$/i.test(name)) return name;
    }
  }

  // Pattern 3: lowercase single-token names ("from amazon") — stoplist-filtered
  for (const prep of preps) {
    const lowRe = new RegExp(`\\b${prep}\\s+([a-z][\\w&.']{2,})`, '');
    const m = text.match(lowRe);
    if (m) {
      const name = cleanName(m[1]);
      if (isPlausibleName(name)) return name;
    }
  }

  return '';
}

// ---------------------------------------------------------------------------
// Category hinting — aligned with CATEGORIES in src/constants/theme.js
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORY_RULES = [
  { id: 'carpenter', re: /\bcarpent|woodwork|wardrobe work|furniture work|kitchen cabinets?|mistr?i\b/i },
  { id: 'electrician', re: /\belectric|wiring|switch(?:es|board)?|light fitting|mcb|fan install/i },
  { id: 'false_ceiling', re: /\bfalse ceiling|ceiling work|pop work|pop ceiling|gypsum\b/i },
  { id: 'measurements', re: /\bmeasurements?|site survey|laser measure\b/i },
  { id: 'designer_architect', re: /\bdesign(?:er)?s? fee|designer|architect|3d design|drawing|render(?:ing)?|layout fee\b/i },
  { id: 'factory_materials', re: /\bfactory|machine|cnc|edge band|press(?:ing)?|modular\b/i },
  { id: 'onsite_materials', re: /\bonsite|on-site|site material|hardware|screws?|hinges?|channels?|adhesives?|fevicol\b/i },
  {
    id: 'construction_material',
    re: /\bcement|sand\b|bricks?|steel|tiles?|marble|granite|plywood|ply\b|mdf|laminates?|veneers?|paint(?:s|ing)?\b|putty|wood\b|timber|glass|aluminium|aluminum|pipes?\b|wires?\b|material/i,
  },
  { id: 'jobwork', re: /\bjob ?work|polish|fabricat|weld|install(?:ation)?|fitting work|labour|labor|painter|plumb|mason\b/i },
  {
    id: 'operational',
    re: /\btravel|fuel|petrol|diesel|food|tea\b|chai|transport|tempo|courier|porter|rent\b|salary|wages|office|stationery|tips?\b|driver|helper\b/i,
  },
];

const INCOMING_CATEGORY_RULES = [
  { id: 'cheque', re: /\bcheque|chq\b|check no|dd\b|demand draft/i },
  { id: 'cash', re: /\bcash\b|nakad|by hand/i },
  { id: 'savings_account', re: /\bsavings?\b/i },
  {
    id: 'current_account',
    re: /\bcurrent (?:a\/?c|account)|neft|rtgs|imps|upi|gpay|google pay|phonepe|paytm|bank transfer|online|credited|transferr?e?d?\b/i,
  },
];

export function hintCategory(text, type) {
  const rules = type === 'incoming' ? INCOMING_CATEGORY_RULES : EXPENSE_CATEGORY_RULES;
  for (const { id, re } of rules) {
    if (re.test(text)) return id;
  }
  return type === 'incoming' ? 'current_account' : 'others_expense';
}

/** Does the text mention a concrete expense-category keyword? */
function matchExpenseCategory(text) {
  for (const { id, re } of EXPENSE_CATEGORY_RULES) {
    if (re.test(text)) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

function buildDescription(text) {
  let desc = text.replace(/\s+/g, ' ').trim();
  if (desc.length > 120) desc = desc.slice(0, 117) + '...';
  return desc;
}

/**
 * Parse a chat message into a transaction candidate.
 *
 * @returns {{
 *   isTransaction: boolean,
 *   type?: 'incoming'|'expense',
 *   amount?: number,
 *   description?: string,
 *   vendor?: string,
 *   category_hint?: string,
 *   confidence: number,      // 0..1 — how sure the rule engine is
 *   source: 'local',
 *   reply?: string,
 * }}
 */
export function parseTransactionText(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { isTransaction: false, confidence: 1, source: 'local' };
  }

  const cleaned = text.trim();

  // Questions are requests for information, not records of money movement
  if (/\?\s*$/.test(cleaned)) {
    return { isTransaction: false, confidence: 0.9, source: 'local' };
  }

  // Quotes/estimates describe future or hypothetical amounts — never
  // auto-record them. Let the LLM double-check the ambiguous ones.
  if (
    /\b(?:quote|quotation|estimate[ds]?|budget(?:ed)?|approx(?:imately)?|around|about|roughly|will\s+(?:cost|be|need)|needs?|chahiye|lagega|lagenge)\b/i.test(
      cleaned
    )
  ) {
    return { isTransaction: false, confidence: 0.4, source: 'local' };
  }

  // Pending / due / future amounts are not money movements either — unless
  // a completed-action verb ("paid", "cleared", "settled", "received")
  // says the dues were actually paid off.
  const hasCompletionVerb =
    /\b(?:paid|cleared|settled|received|got|collected|credited|debited|transferr?ed|done|diya|diye|mila|aaya)\b/i.test(
      cleaned
    );
  if (
    !hasCompletionVerb &&
    /\b(?:pending|due|dues|payable|unpaid|outstanding|baki|baaki|balance|remaining|will\s+(?:pay|send|give|transfer|receive)|have\s+to\s+pay|need(?:s)?\s+to\s+pay|to\s+be\s+paid|yet\s+to)\b/i.test(
      cleaned
    )
  ) {
    return { isTransaction: false, confidence: 0.45, source: 'local' };
  }

  const amountInfo = extractAmount(cleaned);

  // No amount → not a transaction we can record
  if (!amountInfo) {
    return { isTransaction: false, confidence: 0.9, source: 'local' };
  }

  let { type, tieBroken } = detectType(cleaned);
  let base;

  if (type) {
    base = tieBroken ? 0.65 : 0.85;
  } else {
    // No direction verb — fall back to domain priors:
    // a concrete expense-category noun ("cement", "hardware") → expense;
    // client/booking context → incoming.
    if (matchExpenseCategory(cleaned)) {
      type = 'expense';
      base = 0.83;
    } else if (/\b(?:client|customer|advance|booking|installment|instalment)\b/i.test(cleaned)) {
      type = 'incoming';
      base = 0.83;
    } else {
      return { isTransaction: false, confidence: 0.3, source: 'local' };
    }
  }

  const vendor = extractVendor(cleaned, type);
  const category_hint = hintCategory(cleaned, type);

  let confidence = base;
  if (amountInfo.hadCurrencyHint) confidence += 0.07;
  if (vendor) confidence += 0.03;
  if (!/^others_/.test(category_hint)) confidence += 0.02;
  confidence = Math.min(confidence, 0.97);

  return {
    isTransaction: true,
    type,
    amount: Math.round(amountInfo.amount * 100) / 100,
    description: buildDescription(cleaned),
    vendor,
    category_hint,
    confidence,
    source: 'local',
  };
}
