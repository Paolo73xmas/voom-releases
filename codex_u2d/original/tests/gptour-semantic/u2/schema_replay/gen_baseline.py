#!/usr/bin/env python3
"""Baseline DDL derived from the repository's generated Supabase types (src/lib/supabase/database.types.ts).

The repository has no CREATE TABLE source for the core CRM tables (customers, profiles, tabaccherie, ...):
their DDL exists only in the hosted database. This generator rebuilds a LOCAL baseline from the committed
type snapshot so that the real migration SQL files can be replayed unchanged on top of it.
Tables created by the replayed migrations themselves are skipped here (their real DDL wins).
Output: SQL on stdout + JSON summary on stderr. No network, no credentials, no production access.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
TYPES = REPO / 'src/lib/supabase/database.types.ts'
POSTGIS_OWNED = {'spatial_ref_sys', 'geography_columns', 'geometry_columns'}
# Columns whose name does not end in _id/_uid but hold uuid in the hosted schema (from real migrations in repo).
UUID_HINT = {'id', 'created_by', 'updated_by', 'changed_by', 'agent', 'user', 'owner', 'assigned_to', 'merged_into'}
# Hosted column types that contradict the heuristics; provenance: real SQL in repo (policy casts auth.uid()::text).
TYPE_OVERRIDES = {('crm_commission_configs', 'agent_id'): 'text'}


def parse_tables(src):
    tables_src = re.search(r'\n    Tables: \{(.*?)\n    Views: \{', src, re.S).group(1)
    tables = {}
    for m in re.finditer(r'\n      ([a-z_0-9]+): \{\n        Row: \{(.*?)\n        \}\n        Insert: \{(.*?)\n        \}\n        Update: \{.*?\n        \}\n        Relationships: \[(.*?)\]\n      \}', tables_src, re.S):
        name, row, insert, rels = m.groups()
        cols = []
        for line in row.strip().splitlines():
            cm = re.match(r'\s*([a-z_0-9]+)\??: (.+)$', line)
            if cm:
                cols.append((cm.group(1), cm.group(2).strip()))
        optional = set(re.findall(r'\n\s*([a-z_0-9]+)\?:', insert))
        fks = []
        for fk in re.finditer(r'\{\s*foreignKeyName: "([^"]+)"\s*columns: \[([^\]]*)\]\s*isOneToOne: (true|false)\s*referencedRelation: "([^"]+)"\s*referencedColumns: \[([^\]]*)\]\s*\}', rels, re.S):
            fks.append({'name': fk.group(1), 'columns': re.findall(r'"([^"]+)"', fk.group(2)), 'one_to_one': fk.group(3) == 'true',
                        'ref': fk.group(4), 'ref_columns': re.findall(r'"([^"]+)"', fk.group(5))})
        tables[name] = {'columns': cols, 'optional': optional, 'fks': fks}
    return tables


def pg_type(col, ts):
    nullable = ts.endswith('| null')
    base = ts[:-len('| null')].strip() if nullable else ts
    array = base.endswith('[]')
    if array:
        base = base[:-2]
    if base == 'string':
        if col in UUID_HINT or col.endswith(('_id', '_uid', '_by')):
            t = 'uuid'
        elif col.endswith(('_at', 'created', 'updated')):
            t = 'timestamptz'
        elif col.endswith('_date') or col in ('date',):
            t = 'timestamptz'
        else:
            t = 'text'
    elif base == 'number':
        t = 'numeric'
    elif base == 'boolean':
        t = 'boolean'
    elif base == 'Json':
        t = 'jsonb'
    elif base.startswith('"'):
        t = 'text'  # enum literal union, CHECK constraint not reconstructible from types
    else:
        t = 'text'
    return (t + '[]' if array else t), nullable


def default_for(t):
    if t.endswith('[]'):
        return "'{}'"
    return {'uuid': 'gen_random_uuid()', 'timestamptz': 'now()', 'boolean': 'false', 'numeric': '0', 'jsonb': "'{}'::jsonb", 'text': "''"}[t]


def created_by_replay(replay_files):
    created = set()
    rx = re.compile(r'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?', re.I)
    for f in replay_files:
        created.update(x.lower() for x in rx.findall((REPO / f).read_text(errors='replace')))
    return created


def main():
    replay_list = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('replay_set.txt')
    replay_files = [l.strip().lstrip('?').split(' #')[0].strip() for l in replay_list.read_text().splitlines() if l.strip() and not l.startswith('#')]
    tables = parse_tables(TYPES.read_text())
    skip = created_by_replay(replay_files) | POSTGIS_OWNED
    out = ['-- GENERATED LOCAL BASELINE: derived from src/lib/supabase/database.types.ts (type snapshot, not a production dump).',
           '-- Types/defaults are heuristic reconstructions; CHECK constraints, triggers, views and hosted policies are NOT included.',
           'begin;']
    summary = {'tables': 0, 'skipped_created_by_replay': sorted(t for t in tables if t in skip), 'fks': 0, 'fks_skipped': [], 'heuristic_defaults': 0}
    fk_sql = []
    for name in sorted(tables):
        if name in skip:
            continue
        spec = tables[name]
        lines = []
        has_id = any(c == 'id' for c, _ in spec['columns'])
        for col, ts in spec['columns']:
            t, nullable = pg_type(col, ts)
            t = TYPE_OVERRIDES.get((name, col), t)
            d = ''
            if col in spec['optional'] and not nullable:
                d = ' default ' + default_for(t)
                summary['heuristic_defaults'] += 1
            lines.append(f'  "{col}" {t}{"" if nullable else " not null"}{d}')
        if has_id:
            lines.append('  primary key ("id")')
        out.append(f'create table if not exists public."{name}" (\n' + ',\n'.join(lines) + '\n);')
        summary['tables'] += 1
        for fk in spec['fks']:
            ref = fk['ref']
            if ref not in tables or ref in POSTGIS_OWNED or fk['ref_columns'] != ['id'] or not any(c == 'id' for c, _ in tables[ref]['columns']):
                summary['fks_skipped'].append(f"{name}.{fk['name']} -> {ref}({','.join(fk['ref_columns'])})")
                continue
            if ref in skip:
                summary['fks_skipped'].append(f"{name}.{fk['name']} -> {ref} (target created by replayed migration; FK left to real SQL)")
                continue
            cols = ', '.join(f'"{c}"' for c in fk['columns'])
            fk_sql.append(f'do $$ begin if not exists (select 1 from pg_constraint where conname = \'{fk["name"]}\') then '
                          f'alter table public."{name}" add constraint "{fk["name"]}" foreign key ({cols}) references public."{ref}"("id"); end if; '
                          f'exception when others then insert into u2_replay_meta.fk_not_reconstructed(table_name, fk_name, reason) '
                          f'values (\'{name}\', \'{fk["name"]}\', sqlerrm); end $$;')
            summary['fks'] += 1
    out.append('create schema if not exists u2_replay_meta;')
    out.append('create table if not exists u2_replay_meta.fk_not_reconstructed(table_name text, fk_name text, reason text);')
    out.extend(fk_sql)
    out.append('commit;')
    sys.stdout.write('\n'.join(out) + '\n')
    sys.stderr.write(json.dumps(summary, indent=1) + '\n')


if __name__ == '__main__':
    main()
