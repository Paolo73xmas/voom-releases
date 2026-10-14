#!/usr/bin/env python3
"""Only official public release download. Never loads application env/credentials."""
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import tarfile
import urllib.request

version = os.environ['U2_POSTGREST_VERSION']
tools = Path(os.environ['U2_TOOLS_DIR']).resolve()
if not str(tools).startswith(('/opt/', '/tmp/')) or platform.machine() != 'aarch64':
    raise SystemExit('Use an outside-repository /opt or /tmp tools directory on aarch64')
if not version.startswith('v') or not all(c.isdigit() or c in 'v.' for c in version):
    raise SystemExit('Invalid pinned version')
api = f'https://api.github.com/repos/PostgREST/postgrest/releases/tags/{version}'
with urllib.request.urlopen(api, timeout=60) as response:
    release = json.load(response)
name = f'postgrest-{version}-linux-static-aarch64.tar.xz'
asset = next(a for a in release['assets'] if a['name'] == name)
digest = asset.get('digest', '')
if not digest.startswith('sha256:'):
    raise SystemExit('No official release SHA256: refusing unchecked installation')
url = asset['browser_download_url']
if not url.startswith(f'https://github.com/PostgREST/postgrest/releases/download/{version}/'):
    raise SystemExit('Unexpected asset origin')
with urllib.request.urlopen(url, timeout=90) as response:
    archive = response.read()
actual = hashlib.sha256(archive).hexdigest()
if actual != digest.split(':', 1)[1]:
    raise SystemExit('Checksum mismatch')
with tarfile.open(fileobj=io.BytesIO(archive), mode='r:xz') as tar:
    members = [m for m in tar.getmembers() if m.isfile() and Path(m.name).name == 'postgrest']
    if len(members) != 1:
        raise SystemExit('Unexpected archive layout')
    binary = tar.extractfile(members[0]).read()
(tools / 'bin').mkdir(parents=True, exist_ok=True)
(tools / 'bin/postgrest').write_bytes(binary)
(tools / 'bin/postgrest').chmod(0o755)
receipt = {'version': version, 'architecture': platform.machine(), 'asset': name,
           'sha256_archive': actual, 'sha256_binary': hashlib.sha256(binary).hexdigest(),
           'digest_source': api, 'verification': 'matches official GitHub release asset digest (not a GPG signature)'}
(tools / 'installation.json').write_text(json.dumps(receipt, indent=2) + '\n')
print('PASS PostgREST official asset checksum', version, actual)