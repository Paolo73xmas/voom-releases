#!/usr/bin/env python3
"""Real local HTTP/RLS checks. JWTs generated in memory, never printed or archived."""
import base64
import concurrent.futures
import hashlib
import hmac
import json
import os
from pathlib import Path
import stat
import time
from lab_common import settings, local_http, sql_command, pg_run

root, meta = settings()
key = (root / 'jwt.secret').read_bytes()
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
checks = 0

def check(ok, label):
    global checks
    if not ok:
        raise AssertionError(label)  # deliberately no response bodies or JWTs
    checks += 1
    print('PASS', label)

def jwt(sub=A, role='authenticated', expires=600, secret=key, audience='voom-u2-local'):
    def b64(b):
        return base64.urlsafe_b64encode(b).rstrip(b'=')
    now = int(time.time())
    header = b64(json.dumps({'alg':'HS256','typ':'JWT'},separators=(',',':')).encode())
    payload = b64(json.dumps({'sub':sub,'role':role,'aud':audience,'iat':now-120,'exp':now+expires},separators=(',',':')).encode())
    content = header+b'.'+payload
    return (content+b'.'+b64(hmac.new(secret,content,hashlib.sha256).digest())).decode()

def ids(token):
    status, data = local_http(meta, '/owner_probe?select=id&order=id', token=token)
    return status, [r['id'] for r in json.loads(data)] if status == 200 else []

check(stat.S_IMODE((root/'jwt.secret').stat().st_mode) == 0o600, 'ephemeral secret mode600')
check(stat.S_IMODE(root.stat().st_mode) == 0o700, 'runtime directory mode700')
check(ids(None) == (200,[]), 'anonymous sees no rows')
check(ids(jwt(A)) == (200,[1]), 'user A exact set {1}')
check(ids(jwt(B)) == (200,[2]), 'user B exact set {2}')
for label, token in [('expired',jwt(expires=-120)), ('wrong_signature',jwt(secret=b'wrong-secret-not-valid')), ('wrong_audience',jwt(audience='different'))]:
    check(local_http(meta,'/owner_probe',token=token)[0] == 401, 'JWT rejected: '+label)
check(local_http(meta,'/owner_probe',token=jwt(role='postgres'))[0] in (400,401,403), 'forbidden role escalation')
check(local_http(meta,'/owner_probe',token=jwt(role='service_role'))[0] in (400,401,403), 'no service_role access')
check(local_http(meta,'/owner_probe',method='POST',body={'id':99,'owner_uid':A,'label':'anonymous'})[0] in (401,403), 'anonymous insert denied')
check(local_http(meta,'/owner_probe',token=jwt(A),method='POST',body={'id':99,'owner_uid':B,'label':'cross-owner'})[0] == 403, 'cross-owner insert denied')
check(local_http(meta,'/owner_probe?id=eq.1',token=jwt(A),method='PATCH',body={'owner_uid':B})[0] == 403, 'ownership transfer denied')
check(local_http(meta,'/owner_probe?id=eq.2',token=jwt(A),method='PATCH',body={'label':'unauthorized'})[0] == 204, 'cross-owner update affects no visible row')
status, body = local_http(meta,'/owner_probe?id=eq.2&select=label',token=jwt(B))
check(status == 200 and json.loads(body) == [{'label':'synthetic-B'}], 'B row unchanged after A update')
check(local_http(meta,'/owner_probe?id=eq.1',token=jwt(A),method='DELETE')[0] == 403, 'authenticated DELETE forbidden')
status, body = local_http(meta,'/owner_probe?id=eq.2&select=id',token=jwt(A))
check(status == 200 and json.loads(body) == [], 'A explicit B filter invisible')
subjects = [A,B]*12
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda sub: ids(jwt(sub)), subjects))
check(all(result == (200,[1 if sub == A else 2]) for result,sub in zip(results,subjects)), '24 parallel requests: no pooled claims leak')
status, _ = local_http(meta,'/rpc/gptour_semantic_claim',token=jwt(A),method='POST',body={})
check(status == 404, 'no U2-b/c RPC implemented')
query = "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema') and tablename like 'gptour_semantic_%'"
check(pg_run(sql_command(root,meta)+['-Atc',query],text=True).stdout.strip() == '0', 'no U2-b tables')
roles = "select count(*) from pg_roles where rolname in ('u2_authenticator','anon','authenticated') and (rolsuper or rolbypassrls or rolcreaterole)"
check(pg_run(sql_command(root,meta)+['-Atc',roles],text=True).stdout.strip() == '0', 'test roles have no bypass/superuser')
check(pg_run(sql_command(root,meta)+['-Atc','show listen_addresses'],text=True).stdout.strip() == '127.0.0.1', 'PostgreSQL loopback bind')
check('server-host = "127.0.0.1"' in (root/'postgrest.conf').read_text(), 'PostgREST loopback bind')
print(f'LOCAL_VERIFY DONE checks={checks} fail=0; JWT/Auth fixture SYNTHETIC, real PG/PostgREST/RLS')