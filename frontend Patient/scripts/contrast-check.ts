// WCAG contrast check for every colour pair in src/theme/contrastPairs.ts.
// Run: npm run contrast   (exits 1 if any pair fails)
import { evaluate, requiredRatio } from '../src/theme/contrast';
import { CONTRAST_PAIRS } from '../src/theme/contrastPairs';

const results = CONTRAST_PAIRS.map(evaluate);
const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${r.name.padEnd(width)}  ${r.ratio.toFixed(2)}:1  (needs ${requiredRatio(r.kind)}:1, ${r.kind})`);
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pairs pass.`);
process.exit(failed.length ? 1 : 0);
