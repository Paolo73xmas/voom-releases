import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

describe('preparazione build EAS: dipendenze riproducibili', () => {
  it('include un lockfile Yarn reale nella stessa directory del progetto', () => {
    const file = resolve(root, 'yarn.lock');
    expect(existsSync(file)).toBe(true);
    const lock = readFileSync(file, 'utf8');
    expect(lock).toContain('# yarn lockfile v1');
    expect(lock.length).toBeGreaterThan(1000);
    expect(lock).toContain('integrity sha512-');
  });
  it('dichiara Yarn Classic 1.22.22 e conserva i profili EAS senza bypass del lockfile', () => {
    expect(manifest.packageManager).toMatch(/^yarn@1\.22\.22(?:\+sha512\.[a-f0-9]+)?$/);
    const eas = JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8'));
    expect(eas.build.preview.distribution).toBe('internal');
    expect(JSON.stringify(eas)).not.toContain('EAS_BUILD_SKIP_LOCKFILE_CHECK');
    expect(existsSync(resolve(root, 'package-lock.json'))).toBe(false);
    expect(existsSync(resolve(root, 'pnpm-lock.yaml'))).toBe(false);
  });

  it('mantiene i pin compatibili con il worker iOS Node20 senza saltare i controlli', () => {
    expect(manifest.dependencies['@supabase/supabase-js']).toBe('2.109.0');
    expect(manifest.devDependencies.vitest).toBe('4.1.11');
    const lock = readFileSync(resolve(root, 'yarn.lock'), 'utf8');
    expect(lock).toMatch(/"@supabase\/supabase-js@2\.109\.0":\n  version "2\.109\.0"/);
    expect(lock).toMatch(/vitest@4\.1\.11:\n  version "4\.1\.11"/);
    expect(manifest.main).toBe('expo-router/entry');
    expect(manifest.scripts?.postinstall || '').not.toContain('SKIP_LOCKFILE');
  });

  it('non esclude il lockfile dai sorgenti del progetto', () => {
    const ignore = readFileSync(resolve(root, '.gitignore'), 'utf8');
    expect(ignore.trimEnd().endsWith('!/yarn.lock')).toBe(true);
  });
});