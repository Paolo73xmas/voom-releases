// Explicit fixture authoring utility, never invoked by the test runner.
import { writeFileSync } from 'node:fs';
import { goldenCases } from './golden-cases.ts';
if (!process.argv.includes('--write')) throw new Error('Pass --write explicitly; tests must not regenerate snapshots');
writeFileSync('tests/gptour-semantic/u2/transport-goldens.json',JSON.stringify(goldenCases(),null,2)+'\n');
console.log('Wrote synthetic contract fixtures; no service calls');