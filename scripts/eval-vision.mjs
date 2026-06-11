// Vision-path eval: sends synthetic payment-app screenshots through the
// production OpenRouter model chain + system prompt and asserts the
// extracted direction/amount. Locks in the "expense screenshots recorded
// as incoming" fix.
//
// Run: powershell -File scripts/make-test-screenshots.ps1   (once)
//      node scripts/eval-vision.mjs

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const line of readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API_KEY = process.env.OPENROUTER_API_KEY;

const aiSrc = readFileSync(join(__dirname, '..', 'src', 'services', 'ai.js'), 'utf8');
const promptMatch = aiSrc.match(/SYSTEM_PROMPT = `([\s\S]*?)`;\n/);
if (!promptMatch) throw new Error('SYSTEM_PROMPT not found in ai.js');
const SYSTEM_PROMPT = promptMatch[1];
const MODEL_CHAIN = [...aiSrc.matchAll(/'((?:google|nvidia|nex-agi)\/[^']+:free)'/g)].map((m) => m[1]);
console.log('Models:', MODEL_CHAIN.join(' → '));

const CASES = [
  { file: 'gpay-paid.png', expect: { type: 'expense', amount: 4500 }, vendorHint: 'raju' },
  { file: 'gpay-received.png', expect: { type: 'incoming', amount: 25000 }, vendorHint: 'mehta' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callChain(imageB64) {
  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this image (receipt, bill, or payment-app screenshot) and extract the transaction details.' },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageB64}` } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });
      if (resp.status === 429) { await sleep(2500); continue; }
      if (!resp.ok) break;
      const data = await resp.json();
      const msg = data?.choices?.[0]?.message || {};
      const raw = msg.content || msg.reasoning || '';
      const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return { parsed: JSON.parse(jsonMatch[0]), model }; } catch {}
      }
    }
  }
  return { parsed: null, model: null };
}

let pass = 0;
for (const c of CASES) {
  const path = join(__dirname, 'test-assets', c.file);
  if (!existsSync(path)) {
    console.error(`missing ${path} — run scripts/make-test-screenshots.ps1 first`);
    process.exit(2);
  }
  const b64 = readFileSync(path).toString('base64');
  const { parsed, model } = await callChain(b64);
  const ok =
    parsed &&
    parsed.isTransaction === true &&
    parsed.type === c.expect.type &&
    Math.abs(Number(parsed.amount) - c.expect.amount) < 1;
  const vendorOk = !c.vendorHint || String(parsed?.vendor || '').toLowerCase().includes(c.vendorHint);
  console.log(`${ok ? 'PASS' : 'FAIL'}${ok && !vendorOk ? ' (vendor miss)' : ''}  [${model || 'no-model'}] ${c.file}`);
  if (!ok) console.log('       got:', JSON.stringify(parsed));
  if (ok) pass++;
  await sleep(3500);
}

console.log(`\nVision eval: ${pass}/${CASES.length} passed`);
process.exit(pass === CASES.length ? 0 : 1);
