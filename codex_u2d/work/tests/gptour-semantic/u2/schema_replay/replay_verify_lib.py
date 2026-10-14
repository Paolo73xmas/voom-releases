"""Shared helpers for probes (same semantics as replay_verify.py; kept separate so the delivered suite stays untouched)."""
import base64
import hashlib
import hmac
import json
import subprocess
import time
from replay_common import settings, psql
from lab_common import pg_run, local_http

root, meta = settings()
key = (root / 'jwt.secret').read_bytes()
A = 'a0000000-0000-4000-8000-00000000000a'
B = 'b0000000-0000-4000-8000-00000000000b'
C = 'c0000000-0000-4000-8000-00000000000c'


def as_user(uid, role, statement, claims_extra=None, commit=True):
    claims = {'role': role}
    if uid:
        claims['sub'] = uid
    if claims_extra:
        claims.update(claims_extra)
    script = (f"begin; set local role {role}; select set_config('request.jwt.claims', '{json.dumps(claims)}', true);\n"
              f"\\echo __OUT__\n{statement};\n{'commit' if commit else 'rollback'};")
    try:
        out = pg_run(psql(root, meta) + ['-At'], input=script.encode()).stdout.decode()
        return True, out.split('__OUT__\n', 1)[1].strip()
    except subprocess.CalledProcessError as error:
        text = error.stderr.decode(errors='replace')
        return False, text.split('ERROR:', 1)[1].strip().splitlines()[0] if 'ERROR:' in text else text.strip()[-200:]


def jwt(sub=A, role='authenticated', expires=600, secret=key, audience='authenticated', user_metadata=None, extra=None):
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')
    now = int(time.time())
    payload = {'role': role, 'aud': audience, 'iat': now - 120, 'exp': now + expires}
    if sub:
        payload['sub'] = sub
    if user_metadata is not None:
        payload['user_metadata'] = user_metadata
    if extra:
        payload.update(extra)
    header = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    body = b64(json.dumps(payload, separators=(',', ':')).encode())
    content = header + b'.' + body
    return (content + b'.' + b64(hmac.new(secret, content, hashlib.sha256).digest())).decode()


def http(path, token=None, method='GET', body=None):
    status, data = local_http(meta, path, token=token, method=method, body=body)
    try:
        return status, json.loads(data) if data else None
    except ValueError:
        return status, None
