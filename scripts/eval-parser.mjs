// Eval harness for the local transaction parser (src/services/parser.js).
// Run: node scripts/eval-parser.mjs [--verbose]
//
// Scores the rule engine against scripts/eval-dataset.json and prints
// per-field accuracy plus every failing case, so the parser can be
// iterated ("trained") until the suite is green.

import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERBOSE = process.argv.includes('--verbose');

// parser.js is ESM syntax inside a CJS package — stage it as .mjs to import
const parserSrc = readFileSync(join(__dirname, '..', 'src', 'services', 'parser.js'), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'ledge-eval-'));
const stagedPath = join(tmp, 'parser.mjs');
writeFileSync(stagedPath, parserSrc);
const { parseTransactionText } = await import(pathToFileURL(stagedPath).href);

const dataset = JSON.parse(
  readFileSync(join(__dirname, 'eval-dataset.json'), 'utf8')
);

const FAST_PATH_CONFIDENCE = 0.85; // keep in sync with ai.js

let stats = {
  total: 0,
  detectOk: 0,        // isTransaction correct
  typeOk: 0, typeTotal: 0,
  amountOk: 0, amountTotal: 0,
  categoryOk: 0, categoryTotal: 0,
  vendorOk: 0, vendorTotal: 0,
  mustPassOk: 0, mustPassTotal: 0,
};
const failures = [];

for (const c of dataset.cases) {
  stats.total++;
  const r = parseTransactionText(c.text);
  const e = c.expect;
  const issues = [];

  // For localMustPass transactions the parser must hit the fast path;
  // for others, deferring to the LLM (low confidence / not detected) is OK.
  const confidentLocal = r.isTransaction && r.confidence >= FAST_PATH_CONFIDENCE;

  if (c.localMustPass) {
    stats.mustPassTotal++;
    if (e.isTransaction) {
      if (!confidentLocal) issues.push(`expected confident transaction, got isTransaction=${r.isTransaction} conf=${r.confidence}`);
    } else {
      if (r.isTransaction) issues.push(`false positive (parsed a transaction from a non-transaction)`);
    }
  }

  // Detection accuracy (regardless of confidence)
  if (r.isTransaction === e.isTransaction) stats.detectOk++;
  else if (!c.localMustPass && !r.isTransaction && e.isTransaction) {
    // acceptable deferral — count detection as ok for scoring purposes
    stats.detectOk++;
  } else {
    issues.push(`isTransaction=${r.isTransaction}, expected ${e.isTransaction}`);
  }

  if (e.isTransaction && r.isTransaction) {
    stats.typeTotal++;
    if (r.type === e.type) stats.typeOk++;
    else issues.push(`type=${r.type}, expected ${e.type}`);

    stats.amountTotal++;
    if (Math.abs(r.amount - e.amount) < 0.01) stats.amountOk++;
    else issues.push(`amount=${r.amount}, expected ${e.amount}`);

    if (e.category) {
      stats.categoryTotal++;
      if (r.category_hint === e.category) stats.categoryOk++;
      else issues.push(`category=${r.category_hint}, expected ${e.category}`);
    }
    if (e.vendor) {
      stats.vendorTotal++;
      const got = (r.vendor || '').toLowerCase();
      const want = e.vendor.toLowerCase();
      if (got.includes(want) || want.includes(got) && got) stats.vendorOk++;
      else issues.push(`vendor="${r.vendor}", expected ~"${e.vendor}"`);
    }
  }

  if (c.localMustPass && issues.length === 0) stats.mustPassOk++;
  if (issues.length > 0) failures.push({ text: c.text, issues, result: r });
}

const pct = (a, b) => (b === 0 ? '  n/a' : ((100 * a) / b).toFixed(1).padStart(5) + '%');

console.log('================ PARSER EVAL ================');
console.log(`cases           : ${stats.total}`);
console.log(`detection       : ${pct(stats.detectOk, stats.total)}  (${stats.detectOk}/${stats.total})`);
console.log(`type            : ${pct(stats.typeOk, stats.typeTotal)}  (${stats.typeOk}/${stats.typeTotal})`);
console.log(`amount          : ${pct(stats.amountOk, stats.amountTotal)}  (${stats.amountOk}/${stats.amountTotal})`);
console.log(`category        : ${pct(stats.categoryOk, stats.categoryTotal)}  (${stats.categoryOk}/${stats.categoryTotal})`);
console.log(`vendor          : ${pct(stats.vendorOk, stats.vendorTotal)}  (${stats.vendorOk}/${stats.vendorTotal})`);
console.log(`must-pass cases : ${pct(stats.mustPassOk, stats.mustPassTotal)}  (${stats.mustPassOk}/${stats.mustPassTotal})`);
console.log('=============================================');

if (failures.length) {
  console.log(`\n${failures.length} failing case(s):`);
  for (const f of failures) {
    console.log(`\n  "${f.text}"`);
    for (const i of f.issues) console.log(`    - ${i}`);
    if (VERBOSE) console.log(`    → ${JSON.stringify(f.result)}`);
  }
}

const mustPassRate = stats.mustPassTotal ? stats.mustPassOk / stats.mustPassTotal : 1;
process.exit(mustPassRate >= 0.98 && failures.length === 0 ? 0 : 1);
