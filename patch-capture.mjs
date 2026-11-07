// patch-capture.mjs — bind window.figma.__clipboardFlow to the current
// clipboard-flow starter in Figma's capture.js.
//
// Anchors (semantic, not guessed minified names):
//   A1: the native assignment `window.figma.captureForDesign=<name>,`
//   A2: the flow's return literal `return{promise:X,showSuccess:X,showClipboardBar:X,done:X}`
//   A3: brace-balanced walk back from A2 to the enclosing `NAME=function(...)` definition
// Fails LOUDLY (exit 1) if any anchor is missing, so a future Figma bundle
// change breaks the build with a clear message instead of a broken extension.
import fs from 'fs';

const file = process.argv[2] || 'capture.js';
let src = fs.readFileSync(file, 'utf8');

const cfd = src.match(/window\.figma\.captureForDesign=[A-Za-z_$][\w$]*,/);
if (!cfd) { console.error('PATCH FAIL: native window.figma.captureForDesign assignment not found'); process.exit(1); }

// Strip any previously applied patch so re-running is idempotent.
src = src.replace(/window\.figma\.__clipboardFlow=[A-Za-z_$][\w$]*,/g, '');

const anchor = src.match(/return\{promise:[A-Za-z_$][\w$]*,showSuccess:[A-Za-z_$][\w$]*,showClipboardBar:[A-Za-z_$][\w$]*,done:[A-Za-z_$][\w$]*\}/);
if (!anchor) { console.error('PATCH FAIL: clipboard-flow return shape {promise,showSuccess,showClipboardBar,done} not found'); process.exit(1); }

// The char right after the anchor literal should be the flow function's closing brace.
let i = anchor.index + anchor[0].length;
if (src[i] !== '}') { console.error('PATCH FAIL: unexpected char after return literal:', JSON.stringify(src.slice(i, i + 20))); process.exit(1); }
let depth = 1, j = i;
while (depth > 0 && j > 0) {
  j--;
  if (src[j] === '}') depth++;
  else if (src[j] === '{') depth--;
}
if (depth !== 0) { console.error('PATCH FAIL: brace matching failed'); process.exit(1); }
const head = src.slice(Math.max(0, j - 120), j);
const def = head.match(/([A-Za-z_$][\w$]*)=function\([^)]*\)$/) || head.match(/function ([A-Za-z_$][\w$]*)\([^)]*\)$/);
if (!def) { console.error('PATCH FAIL: could not name the enclosing function near:', JSON.stringify(head.slice(-60))); process.exit(1); }
const flowName = def[1];

// Sanity: the same name must be callable as flowName("body", ...) elsewhere.
const callRe = new RegExp(flowName.replace(/\$/g, '\\$') + '\\("body"');
if (!callRe.test(src)) { console.error('PATCH FAIL: ' + flowName + ' never called with "body" - wrong function?'); process.exit(1); }

const patched = src.replace(cfd[0], cfd[0] + 'window.figma.__clipboardFlow=' + flowName + ',');
if (patched === src) { console.error('PATCH FAIL: insertion point vanished'); process.exit(1); }
fs.writeFileSync(file, patched);
console.log('PATCH OK: window.figma.__clipboardFlow=' + flowName + ' (anchored on return shape, not a hardcoded name)');
