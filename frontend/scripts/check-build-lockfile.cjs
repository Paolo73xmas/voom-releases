// Read-only pre-build gate. Does not git add/commit/push and does not install packages.
/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const lock = path.join(root, 'yarn.lock');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
try {
  if (!manifest.packageManager.startsWith('yarn@1.22.22')) throw new Error('Package manager inatteso');
  if (!fs.existsSync(lock) || !fs.readFileSync(lock, 'utf8').includes('# yarn lockfile v1')) throw new Error('Lockfile Yarn mancante o non valido');
  execFileSync('git', ['ls-files', '--error-unmatch', 'yarn.lock'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['cat-file', '-e', 'HEAD:frontend/yarn.lock'], { cwd: root, stdio: 'pipe' });
  console.log('PASS: Yarn 1.22.22, lockfile presente, tracciato e incluso in HEAD.');
} catch (error) {
  console.error('BLOCKED: non preparare una build da questo snapshot. frontend/yarn.lock deve essere presente, tracciato e incluso nel commit.');
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'Verifica non riuscita');
  process.exitCode = 1;
}