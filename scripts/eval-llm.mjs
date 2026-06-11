// LLM-path eval: runs a small set of tricky cases through the real
// OpenRouter chain using the production system prompt from src/services/ai.js.
// Kept small + sequential to respect free-tier quotas (~50 req/day).
//
// Run: node scripts/eval-llm.mjs

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- env ---
for (const line of readFileSync(join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const API_KEY = process.env.OPENROUTER_API_KEY;

// --- pull SYSTEM_PROMPT + MODEL_CHAIN from the production source ---
const aiSrc = readFileSync(join(__dirname, '..', 'src', 'services', 'ai.js'), 'utf8');
const promptMatch = aiSrc.match(/SYSTEM_PROMPT = `([\s\S]*?)`;\n/);
if (!promptMatch) throw new Error('SYSTEM_PROMPT not found in ai.js');
const SYSTEM_PROMPT = promptMatch[1];
const MODEL_CHAIN = [...aiSrc.matchAll(/'((?:google|nvidia|nex-agi)\/[^']+:free)'/g)].map((m) => m[1]);
console.log('Models:', MODEL_CHAIN.join(' → '));

// Hard cases the local parser intentionally defers on
const CASES = [
  { text: 'Shree Traders ka final bill 33,000 clear kar diya', expect: { type: 'expense', amount: 33000 } },
  { text: 'mehta sahab ne 2 lakh aur bheje hain', expect: { type: 'incoming', amount: 200000 } },
  { text: 'adjusted 15000 against last month advance from client', expect: { type: 'incoming', amount: 15000 } },
  { text: 'returned 5000 extra to client for overbilling', expect: { type: 'expense', amount: 5000 } },
  { text: 'carpenter ne 3 din ka 4500 liya', expect: { type: 'expense', amount: 4500 } },
  { text: 'half payment 62,500 done for the wardrobe shutters order', expect: { type: 'expense', amount: 62500 } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callChain(text) {
  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
      });
      if (resp.status === 429) { await sleep(2000); continue; }
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
  const { parsed, model } = await callChain(c.text);
  const ok =
    parsed &&
    parsed.isTransaction === true &&
    parsed.type === c.expect.type &&
    Math.abs(Number(parsed.amount) - c.expect.amount) < 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${model || 'no-model'}] "${c.text}"`);
  if (!ok) console.log('       got:', JSON.stringify(parsed));
  if (ok) pass++;
  await sleep(3500); // free-tier pacing
}

console.log(`\nLLM eval: ${pass}/${CASES.length} passed`);
process.exit(pass >= Math.ceil(CASES.length * 0.8) ? 0 : 1);
