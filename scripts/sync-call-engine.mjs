#!/usr/bin/env node
// The consultation-call engine lives once, in shared/call/. Both apps get an identical copy in
// src/services/call/ (their bundlers, Vite and Metro, can't import from outside the app folder).
//
//   node scripts/sync-call-engine.mjs          copy shared/call/ into both apps
//   node scripts/sync-call-engine.mjs --check  exit 1 if any copy differs (for CI / before committing)
//
// Edit the files in shared/call/, then run the sync. Never edit the copies inside the apps.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = join(root, 'shared', 'call');
const targets = [
  { dir: join(root, 'frontend Doctor', 'src', 'services', 'call'), skip: [] },
  // The lobby (patients calling a doctor on any page) is doctor-only.
  { dir: join(root, 'frontend Patient', 'src', 'services', 'call'), skip: ['useDoctorLobby.ts'] },
];
const header = (name) =>
  `// GENERATED COPY of shared/call/${name}. Do not edit here: edit shared/call/${name},\n` +
  `// then run \`node scripts/sync-call-engine.mjs\`.\n\n`;

const check = process.argv.includes('--check');
const files = readdirSync(shared).filter((f) => f.endsWith('.ts'));
let stale = 0;
for (const { dir, skip } of targets) {
  for (const name of files) {
    if (skip.includes(name)) continue;
    const wanted = header(name) + readFileSync(join(shared, name), 'utf8');
    const path = join(dir, name);
    const have = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
    if (have === wanted) continue;
    stale++;
    if (check) console.error(`out of date: ${path}`);
    else { writeFileSync(path, wanted); console.log(`updated ${path}`); }
  }
}
if (check && stale) {
  console.error(`\n${stale} copy(ies) differ from shared/call/. Run: node scripts/sync-call-engine.mjs`);
  process.exit(1);
}
if (!stale) console.log('Call engine copies are up to date.');
