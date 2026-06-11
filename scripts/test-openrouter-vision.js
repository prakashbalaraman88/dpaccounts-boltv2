// Tests whether the OpenRouter model accepts image input (needed for receipt scanning).
// Run: node scripts/test-openrouter-vision.js [modelId]

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
const MODEL = process.argv[2] || process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free';

async function main() {
  const imgPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const b64 = fs.readFileSync(imgPath).toString('base64');
  console.log(`Testing image input on: ${MODEL} (image ${Math.round(b64.length / 1024)}KB b64)`);

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
          content: [
            { type: 'text', text: 'In one short sentence, what do you see in this image?' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 100,
    }),
  });

  const body = await res.json().catch(() => null);
  console.log(`HTTP ${res.status}`);
  if (!res.ok) {
    console.error('IMAGE NOT SUPPORTED or error:', JSON.stringify(body?.error || body).slice(0, 400));
    process.exit(1);
  }
  const msg = body?.choices?.[0]?.message || {};
  console.log('Reply:', (msg.content || msg.reasoning || '').trim().slice(0, 300));
  console.log('PASS: model accepts image input');
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
