'use strict';
// Maintainer-only generator. The recipient runs the generated single .cjs WITHOUT TypeScript/npm.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'frontend/node_modules/typescript'));
const names = ['contract', 'errors', 'coordinates', 'wire-contract', 'wire-actions', 'wire-response', 'presentation', 'request', 'view', 'binding'];
const sources = names.map(name => {
  const text = fs.readFileSync(path.join(root, 'frontend/lib/aitour/orchestrator', `${name}.ts`), 'utf8');
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = [...code.matchAll(/require\("([^\"]+)"\)/g)].map(m => m[1]);
  if (imports.some(value => !names.some(n => value === `./${n}`))) throw new Error('Non-pure module dependency refused');
  return { name, code, sha256: crypto.createHash('sha256').update(text).digest('hex') };
});
const provenance = { source: 'VOOM Mobile pure Orchestrator functions', moduleCount: names.length,
  fingerprint: crypto.createHash('sha256').update(sources.map(s => `${s.name}:${s.sha256}`).join('\n')).digest('hex'),
  files: sources.map(s => ({ module: `${s.name}.ts`, sha256: s.sha256 })) };
const checks = fs.readFileSync(path.join(__dirname, 'checks.cjs'), 'utf8').replace('module.exports = { createVerifier };', '');
const cli = fs.readFileSync(path.join(__dirname, 'cli.cjs'), 'utf8').replace('module.exports = { runCli };', '');
const factories = sources.map(s => `${JSON.stringify(`./${s.name}`)}: function(module, exports, require) {\n${s.code}\n}`).join(',\n');
const code = `#!/usr/bin/env node
'use strict';
// STANDALONE TEXT SOURCE. No external dependencies, Mobile workspace, fixtures or credentials required.
// Generated from the actual Mobile pure functions; only TypeScript annotations/module syntax transformed.
// This checks contract and shared view-model fidelity, NOT Android/iPhone/browser rendering.
const factories = {\n${factories}\n};
const cache = Object.create(null);
function mobileRequire(name) {
  if (!Object.hasOwn(factories, name)) throw new Error('Forbidden dependency');
  if (!cache[name]) { const m = { exports: {} }; cache[name] = m; factories[name](m, m.exports, mobileRequire); }
  return cache[name].exports;
}
const mobile = Object.assign({}, ...${JSON.stringify(names.map(n => `./${n}`))}.map(mobileRequire));
${checks}
${cli}
const api = createVerifier(mobile, ${JSON.stringify(provenance, null, 2)});
module.exports = { verifyTurns: api.verifyTurns, provenance: ${JSON.stringify(provenance)} };
if (require.main === module) process.exitCode = runCli(api, process.argv.slice(2));
`;
const destination = path.join(__dirname, 'gptour-p1-verify.cjs');
const sourceHash = crypto.createHash('sha256').update(code).digest('hex');
const handoff = fs.readFileSync(path.join(__dirname, 'handoff-instructions.md'), 'utf8').replaceAll('{{VERIFIER_SHA256}}', sourceHash)
  + '\n\n## Codice completo da salvare come `gptour-p1-verify.cjs`\n\n```javascript\n' + code + '```\n';
const handoffPath = path.join(__dirname, 'TRANSFER_TO_AI_WEB.md');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== code
    || !fs.existsSync(handoffPath) || fs.readFileSync(handoffPath, 'utf8') !== handoff) {
    process.stderr.write('Portable verifier is stale. Regenerate before delivery.\n'); process.exitCode = 1;
  } else process.stdout.write('Portable source matches current pure Mobile functions.\n');
} else {
  fs.writeFileSync(destination, code, { mode: 0o600 });
  fs.writeFileSync(handoffPath, handoff, { mode: 0o600 });
  process.stdout.write('Standalone source and complete textual handoff generated; no fixture read and no network used.\n');
}