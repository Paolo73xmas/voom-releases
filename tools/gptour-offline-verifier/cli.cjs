'use strict';
function runCli(api, argv) {
  const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
  const MAX_BYTES = 32 * 1024 * 1024;
  const fail = code => { const error = new Error('Verification stopped'); error.safeCode = code; throw error; };
  // Defense in depth; neither the CLI nor the copied mobile modules imports network code.
  globalThis.fetch = () => { throw new Error('NETWORK_DISABLED'); };
  globalThis.WebSocket = class { constructor() { throw new Error('NETWORK_DISABLED'); } };
  const files = [], before = [], selectors = [];
  let output, report, exitCode = 2;
  function pointer(root, value) {
    if (value === '') return root;
    if (!value.startsWith('/')) fail('INVALID_JSON_POINTER');
    let current = root;
    for (const token of value.slice(1).split('/')) {
      if (/~(?![01])/u.test(token)) fail('INVALID_JSON_POINTER');
      const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) fail('JSON_POINTER_NOT_FOUND');
      current = current[key];
    }
    return current;
  }
  function read(file) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) fail('LOCAL_FILES_ONLY');
    let buffer;
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size > MAX_BYTES) fail('INPUT_SIZE_OR_TYPE');
      buffer = fs.readFileSync(file);
    } catch (e) { if (e.safeCode) throw e; fail('INPUT_READ_FAILED'); }
    before.push({ file, digest: crypto.createHash('sha256').update(buffer).digest('hex') });
    try { return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, '')); }
    catch { fail('INPUT_NOT_VALID_JSON'); }
  }
  try {
    if (argv.length === 1 && argv[0] === '--help') {
      process.stdout.write('Offline P1 verifier — Node.js18+; no dependencies or network.\n'
        + 'node gptour-p1-verify.cjs --input /private/three-turns.json [--report /private/NEW-report.json]\n'
        + 'node gptour-p1-verify.cjs --turn1 /private/one.json --turn2 /private/two.json --turn3 /private/three.json [--report /private/NEW-report.json]\n'
        + 'Custom container: --input file.json --select /a/response --select /b/response --select /c/response\n'
        + 'Default container: array of3, or {turns:[...]}, or {responses:[...]}. Each entry is a response or {request,response}.\n'
        + 'Exit0 PASS;1 check failure;2 invalid input/output. Reports never contain raw values/paths/IDs/coordinates.\n'
        + 'Do not upload original fixtures. Transfer only the aggregate report. No native/UI rendering claim.\n');
      return 0;
    }
    const options = {};
    for (let i = 0; i < argv.length; i += 2) {
      const key = argv[i], value = argv[i + 1];
      if (!['--input', '--turn1', '--turn2', '--turn3', '--report', '--select'].includes(key) || value === undefined || value.startsWith('--')) fail('INVALID_ARGUMENTS');
      if (key === '--select') selectors.push(value);
      else { if (Object.hasOwn(options, key)) fail('DUPLICATE_ARGUMENT'); options[key] = value; }
    }
    output = options['--report'];
    let turns;
    if (options['--input']) {
      if (['--turn1', '--turn2', '--turn3'].some(k => options[k])) fail('MIXED_INPUT_MODES');
      files.push(options['--input']);
      const root = read(files[0]);
      if (selectors.length) {
        if (selectors.length !== 3) fail('THREE_SELECTORS_REQUIRED');
        turns = selectors.map(s => pointer(root, s));
      } else turns = Array.isArray(root) ? root : root?.turns ?? root?.responses;
    } else {
      if (selectors.length || !['--turn1', '--turn2', '--turn3'].every(k => options[k])) fail('THREE_FILES_REQUIRED');
      files.push(options['--turn1'], options['--turn2'], options['--turn3']);
      if (new Set(files.map(p => fs.realpathSync(p))).size !== 3) fail('DISTINCT_FILES_REQUIRED');
      turns = files.map(read);
    }
    if (!Array.isArray(turns) || turns.length !== 3) fail('INPUT_SHAPE_THREE_TURNS_REQUIRED');
    report = api.verifyTurns(turns);
    exitCode = report.result === 'PASS' ? 0 : 1;
  } catch (error) {
    report = api.base(); report.result = 'ERROR';
    report.checks.push({ code: error.safeCode || 'INPUT_OR_VERIFIER_ERROR', result: 'FAIL' });
    api.finish(report); report.result = 'ERROR';
  }
  let unchanged = true;
  try {
    unchanged = before.every(({ file, digest }) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') === digest);
  } catch { unchanged = false; }
  report.inputFilesUnchanged = unchanged;
  report.inputFilesRead = before.length;
  if (!unchanged) { report.checks.push({ code: 'INPUT_FILE_CHANGED_DURING_CHECK', result: 'FAIL' }); api.finish(report); exitCode = 2; }
  report.exitCode = exitCode;
  if (output) {
    try {
      if (files.some(file => path.resolve(file) === path.resolve(output))) fail('OUTPUT_MUST_NOT_OVERWRITE_INPUT');
      // Exclusive creation also prevents symlink/hardlink clobbering of originals or old reports.
      fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    } catch {
      report.checks.push({ code: 'REPORT_CREATE_REFUSED_NO_OVERWRITE', result: 'FAIL' });
      api.finish(report); report.result = 'ERROR'; report.exitCode = 2; exitCode = 2;
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return exitCode;
}
module.exports = { runCli };