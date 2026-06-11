// Quick connectivity test for the OpenRouter API + free Gemma model.
// Run: node scripts/test-openrouter.js
// Reads OPENROUTER_API_KEY from env, falling back to .env in project root.

const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadDotEnv();

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';

async function main() {
  if (!API_KEY) {
    console.error('FAIL: OPENROUTER_API_KEY not set');
    process.exit(1);
  }

  console.log(`Testing OpenRouter with model: ${MODEL}`);
  const started = Date.now();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content:
            'Extract the transaction from this text and reply with ONLY a JSON object ' +
            '{"amount": number, "type": "income"|"expense", "description": string}: ' +
            '"Paid 2500 rupees to carpenter for wardrobe work"',
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`HTTP ${res.status} in ${elapsed}s`);

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('FAIL — response body:', JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const msg = body?.choices?.[0]?.message || {};
  const text = msg.content || msg.reasoning || '';
  console.log('Model reply:', text.trim().slice(0, 400));

  // Verify the reply parses as the JSON we asked for
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('WARN: no JSON object found in reply');
    process.exit(2);
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('Parsed JSON OK:', parsed);
    console.log('PASS: OpenRouter + model working');
  } catch (e) {
    console.error('WARN: JSON parse failed:', e.message);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
