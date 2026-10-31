// Headless check of "double tap to hear" on the exported web build.
// Usage: node e2e-speech.mjs <devtools-port> <app-url>
const [port, appUrl] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION', msg.params.exceptionDetails.exception?.description?.slice(0, 300));
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};

// ------------------------------------------------------------------ page setup (mocks)
const mocks = `
(() => {
  window.__spoken = []; window.__cancels = 0;
  const voices = [
    { voiceURI: 'en-IN', lang: 'en-IN', name: 'English India', default: true, localService: true },
    { voiceURI: 'hi-IN', lang: 'hi-IN', name: 'Hindi India', default: false, localService: true },
  ];
  const synth = {
    speaking: false, onvoiceschanged: null,
    getVoices: () => voices,
    speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice && u.voice.voiceURI }); this._u = u; setTimeout(() => u.onstart && u.onstart({}), 5); },
    cancel() { window.__cancels++; const u = this._u; this._u = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); },
    pause() {}, resume() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text || ''; } };
  window.WebSocket = class { constructor() {} send() {} close() {} };
  const iso = (d) => d.toISOString().slice(0, 10);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const next = { appointmentId: 'a1', patientId: 'u1', date: day(1), time: '11:20 AM IST', relativeTime: 'Tomorrow', mode: 'video',
    doctorName: 'Dr. Farah Khan (MD Dermatology)', specialty: 'Dermatology', facility: 'Hassan Institute of Medical Sciences · OPD Block',
    agenda: 'Skin rash on both arms', status: 'scheduled', instructionsForPatient: [], isRescheduled: false, department: 'dermatology' };
  const other = { ...next, appointmentId: 'a2', date: day(2), time: '10:30 AM IST', doctorName: 'Dr. C. R. Patil (MS, MCh Urology)', department: 'urology', agenda: '' };
  const routes = {
    '/auth/login': { success: true, token: 't', user: { user_id: 'u1', full_name: 'Ramesh Naik', role: 'patient', preferred_language: 'en' } },
    '/appointments/next': next,
    '/care/appointments': { upcoming: [next, other], past: [] },
    '/chat/unread': { count: 2 },
    '/calls/active-encounter': { encounter_id: null },
    '/care/my-doctors/d1': { next_free: null, doctor: { languages: ['en', 'hi'], practitioner_id: 'd1', name: 'Dr. Farah Khan (MD Dermatology)', department: 'dermatology', specialty: 'Dermatology',
      reason: 'Skin rash', issue_id: 'skin_hair', added_at: null, next_appointment: next, upcoming_count: 1, last_visit_at: null,
      visit_count: 0, medicines_count: 0, unread_messages: 0 }, upcoming: [next], visits: [], cancelled: [], medicines: [] },
    '/care/my-doctors': [{ practitioner_id: 'd1', name: 'Dr. Farah Khan (MD Dermatology)', department: 'dermatology', specialty: 'Dermatology',
      reason: 'Skin rash', issue_id: 'skin_hair', added_at: null, next_appointment: next, upcoming_count: 1, last_visit_at: null,
      visit_count: 0, medicines_count: 0, unread_messages: 0 }],
    '/careplan': { doctor_name: null, facility: null, medications: [], doses_today: {}, checkin_today: null, latest_note: null },
  };
  window.fetch = async (url) => {
    const path = new URL(String(url), location.href).pathname.replace(/^\\/api/, '');
    const key = Object.keys(routes).find((k) => path.endsWith(k));
    const body = key ? routes[key] : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
})();`;
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: mocks });
await send('Page.navigate', { url: appUrl });
await sleep(2500);
await evaluate('localStorage.clear(); true'); // fresh install: first-run hint again
await send('Page.navigate', { url: appUrl });
await sleep(4000);

// ------------------------------------------------------------------ helpers
/** Centre of the innermost visible element whose own text equals / starts with `text`. */
const find = (text, { exact = true, nth = 0 } = {}) =>
  evaluate(`(() => {
    const want = ${JSON.stringify(text)};
    const els = [...document.querySelectorAll('body *')].filter((el) => {
      const t = (el.innerText || '').trim();
      if (!(${exact} ? t === want : t.startsWith(want))) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const st = getComputedStyle(el);
      return st.visibility !== 'hidden' && st.opacity !== '0';
    });
    const inner = els.filter((el) => !els.some((o) => o !== el && el.contains(o)));
    const el = inner[${nth}];
    if (!el) return null;
    const r0 = el.getBoundingClientRect();
    if (r0.top < 70 || r0.bottom > innerHeight - 70) el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  })()`);
const has = (text) => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
const click = async (pt, count = 1) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
  for (let i = 1; i <= count; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: i });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: i });
    if (i < count) await sleep(90);
  }
};
const spoken = () => evaluate('window.__spoken.slice()');
const clearSpoken = () => evaluate('window.__spoken = []; window.__cancels = 0; true');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const lastText = async () => (await spoken()).at(-1)?.text ?? '(nothing)';

// ------------------------------------------------------------------ 1. login screen
let btn = await find('Continue with ABHA', { exact: false });
check('login screen rendered', !!btn);
await clearSpoken();
await click(btn, 2);
await sleep(600);
check('double click on button speaks, action does not run', !(await has('Verify & Sign In')), `spoke: ${await lastText()}`);
await click(btn, 1);
await sleep(150);
const early = await has('Verify & Sign In');
await sleep(400);
check('single click runs action after the short wait', !early && (await has('Verify & Sign In')));
await click(await find('Verify & Sign In', { exact: false }), 1);
await sleep(2500);

// ------------------------------------------------------------------ 2. first-run hint
if (process.env.DUMP) { console.log((await evaluate('document.body.innerText')).slice(0, 600)); }
check('first-run hint shown', await has('Double tap anything to hear it'));
check('hint is read aloud', (await spoken()).some((s) => s.text.startsWith('Welcome. Double tap anything')));
await click(await find('Got it'), 1);
await sleep(800);
check('hint dismissed', !(await has('Double tap anything to hear it')));

// ------------------------------------------------------------------ 3. home card: innermost wins
await clearSpoken();
await click(await find('Dr. Farah Khan'), 2);
await sleep(300);
check('doctor name speaks its own script', (await lastText()) === 'Your doctor is Doctor Farah Khan.', await lastText());
await clearSpoken();
await click(await find('MD Dermatology'), 2);
await sleep(300);
const qualText = await lastText();
check(
  'qualification speaks its own script',
  qualText.startsWith('Doctor Farah Khan has an M.D. degree in Dermatology') ||
    qualText.startsWith('Doctor Farah Khan has an M D degree in Dermatology'),
  qualText
);
check('only one thing spoken per double tap', (await spoken()).length === 1, String((await spoken()).length));
await clearSpoken();
const eyebrow = await find('NEXT APPOINTMENT', { exact: false });
// Empty card area: just right of the eyebrow row's left edge, below it (padding between rows)
await click({ x: eyebrow.x, y: eyebrow.y + eyebrow.h / 2 + 8 }, 2);
await sleep(300);
check('card empty area speaks the card summary', (await lastText()).startsWith('You have an appointment with Doctor Farah Khan tomorrow'), await lastText());
await clearSpoken();
await click(await find('Listen'), 1);
await sleep(300);
const listenText = await lastText();
check('Listen button says exactly the card script', listenText.startsWith('You have an appointment with Doctor Farah Khan tomorrow'), listenText);
check('speech uses the en-IN voice at a slower rate', (await spoken()).at(-1)?.voice === 'en-IN' && Math.abs((await spoken()).at(-1)?.rate - 0.88) < 0.01);

// ------------------------------------------------------------------ 4. critical action: SOS
await clearSpoken();
const sos = await find('Emergency SOS', { exact: false });
await click(sos, 2);
await sleep(700);
check('double click on SOS speaks and does not open SOS', !(await has('Call 108')) && (await lastText()).startsWith('Emergency help'), await lastText());

// ------------------------------------------------------------------ 5. tabs
await clearSpoken();
await click(await find('Medications'), 2);
await sleep(600);
check('double click on tab speaks, stays on Today', (await lastText()).startsWith('Medications. See the medicines') && (await has('Quick Actions')), await lastText());
await click(await find('Medications'), 1);
await sleep(1200);
check('single click on tab navigates', !(await has('Quick Actions')));
const cancelsBefore = await evaluate('window.__cancels');
check('navigating stops speech', cancelsBefore > 0, `cancel() calls: ${cancelsBefore}`);
await click(await find('Today'), 1);
await sleep(1500);

// ------------------------------------------------------------------ 6. no voice for Kannada
await click(await find('English', { exact: false }), 1);
await sleep(1200);
await clearSpoken();
const kn = await find('ಔಷಧಿಗಳು', { exact: false });
if (kn) await click(kn, 2);
await sleep(400);
check('Kannada without a voice: nothing spoken, notice shown', (await spoken()).length === 0 && (await has('ಧ್ವನಿ ಇನ್‌ಸ್ಟಾಲ್ ಆಗಿಲ್ಲ')), `spoken=${(await spoken()).length}`);
// to Hindi (has a voice)
await click(await find('ಕನ್ನಡ', { exact: false }), 1);
await sleep(1200);
await clearSpoken();
const hiTab = await find('दवाइयाँ', { exact: false });
if (hiTab) await click(hiTab, 2);
await sleep(400);
check('Hindi script with the hi-IN voice', (await spoken()).at(-1)?.voice === 'hi-IN' && (await lastText()).startsWith('दवाइयाँ।'), await lastText());
await click(await find('हिंदी', { exact: false }), 1); // back to English
await sleep(1200);

// ------------------------------------------------------------------ 6b. text inside a tappable card
await click(await find('Doctors'), 1);
await sleep(1500);
await clearSpoken();
const reason = await find('Skin rash');
check('doctor card rendered', !!reason);
await click(reason, 2);
await sleep(500);
check('double click on text in a card speaks that text, card stays closed', (await lastText()) === 'Skin rash' && (await has('Looking after')), await lastText());
const listText = await evaluate('document.body.innerText');
await click(reason, 1);
await sleep(1200);
const detailText = await evaluate('document.body.innerText');
check('single click on text in a card opens the card', detailText !== listText && detailText.includes('Skin rash'));
await click(await find('Today'), 1);
await sleep(1500);

// ------------------------------------------------------------------ 7. settings toggle off
await clearSpoken();
const toggle = await evaluate(`(() => { const el = document.querySelector('[role="switch"]'); if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
await sleep(300);
const toggle2 = await evaluate(`(() => { const r = document.querySelector('[role="switch"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
check('settings toggle present', !!toggle);
await click(toggle2, 1);
await sleep(700);
const t0 = Date.now();
await click(await find('Medications'), 1);
await sleep(120);
const navigatedFast = !(await has('Quick Actions'));
check('toggle off: single tap acts with no wait', navigatedFast, `${Date.now() - t0} ms`);
check('toggle off: nothing spoken', (await spoken()).length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail ? 1 : 0);
