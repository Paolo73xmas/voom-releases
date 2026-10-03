// Read-only pre-build gate. Does not git add/commit/push and does not install packages.
/* global __dirname, require, module */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const buildFiles = ['package.json', '.yarnrc', 'yarn.lock'];

function assertBuildSnapshot(local, saved) {
  const manifest = JSON.parse(local['package.json']);
  if (!/^yarn@1\.22\.22(?:\+|$)/.test(manifest.packageManager || '')) throw new Error('Package manager inatteso');
  if (!local['yarn.lock']?.includes('# yarn lockfile v1')) throw new Error('Lockfile Yarn mancante o non valido');
  if (!/^registry\s+"https:\/\/registry\.npmjs\.org\/?"\s*$/m.test(local['.yarnrc'] || '')) throw new Error('Registro npm mancante in .yarnrc');
  if (/^\s*resolved\s+"https?:\/\/registry\.yarnpkg\.com\//m.test(local['yarn.lock'])) throw new Error('yarn.lock contiene ancora URL del vecchio registro Yarn');
  for (const file of buildFiles) {
    if (typeof saved[file] !== 'string') throw new Error(`${file} manca nel commit HEAD`);
    if (local[file] !== saved[file]) throw new Error(`${file} nel commit HEAD non coincide con il file locale verificato`);
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  try {
    const local = {}, saved = {};
    for (const file of buildFiles) {
      local[file] = fs.readFileSync(path.join(root, file), 'utf8');
      try {
        saved[file] = execFileSync('git', ['show', `HEAD:frontend/${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch { throw new Error(`${file} non leggibile nel commit HEAD`); }
    }
    assertBuildSnapshot(local, saved);
    console.log('PASS: Yarn 1.22.22, registro npm, manifest/config/lock identici in locale e HEAD.');
    console.log('Questo controllo non verifica l’archivio remoto EAS né il suo code version ID.');
  } catch (error) {
    console.error('BLOCKED: i file di build corretti devono essere tutti inclusi nel commit salvato.');
    console.error(error instanceof Error ? error.message.split('\n')[0] : 'Verifica non riuscita');
    process.exitCode = 1;
  }
}

module.exports = { assertBuildSnapshot };
if (require.main === module) main();