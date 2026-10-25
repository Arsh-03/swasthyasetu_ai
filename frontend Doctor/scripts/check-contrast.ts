/**
 * npm run check:contrast — WCAG 2.x ratios for every text / icon / focus pair in
 * src/styles/contrastPairs.ts, computed from the values in src/styles/tokens.css.
 * Exits 1 if any pair fails. `npm run check:contrast -- --md` prints a Markdown table for the docs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evaluate, parseTokens, requiredRatio } from '../src/styles/contrast.ts';
import { buildContrastPairs } from '../src/styles/contrastPairs.ts';

const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8');
const results = buildContrastPairs(parseTokens(css)).map(evaluate);
const failed = results.filter((r) => !r.pass);

if (process.argv.includes('--md')) {
  console.log('| Group | Pair | Kind | Ratio | Needs | Result |\n|---|---|---|---|---|---|');
  for (const r of results)
    console.log(`| ${r.group} | ${r.name} | ${r.kind} | ${r.ratio.toFixed(2)}:1 | ${requiredRatio(r.kind)}:1 | ${r.pass ? 'Pass' : '**FAIL**'} |`);
} else {
  const width = Math.max(...results.map((r) => r.name.length));
  let group = '';
  for (const r of results) {
    if (r.group !== group) console.log(`\n${(group = r.group)}`);
    console.log(`  ${r.pass ? 'pass' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.ratio.toFixed(2).padStart(5)}:1  (needs ${requiredRatio(r.kind)}:1, ${r.kind})`);
  }
  console.log(`\n${results.length} pairs, ${failed.length} failing`);
}
process.exit(failed.length ? 1 : 0);
