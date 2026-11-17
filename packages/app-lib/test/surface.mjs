/**
 * SurrealDbService surface test
 *
 * boots the real `SurrealDbModule` (no HTTP app) and drives the full public
 * `SurrealDbService` API against a live SurrealDB server, printing a PASS/FAIL
 * matrix. used as the acceptance gate for server migrations (ex 3.x -> 4.x).
 *
 * configuration via env (same names as the demo app):
 *   SURREALDB_URL       default ws://127.0.0.1:8001/rpc
 *   SURREALDB_NAMESPACE default test
 *   SURREALDB_DATABASE  default test
 *   SURREALDB_USERNAME  default root
 *   SURREALDB_PASSWORD  default root
 *   SURREALDB_SURFACE_INITDB  set to "false" to skip the initdb.surql import
 *
 * usage: yarn --cwd packages/app-lib surface
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// required before any Nest decorator metadata resolution
require('reflect-metadata');
const { Module, Logger } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { SurrealDbModule, SurrealDbService } = require('../dist/index.js');

const env = process.env;
const config = {
  url: env.SURREALDB_URL || 'ws://127.0.0.1:8001/rpc',
  namespace: env.SURREALDB_NAMESPACE || 'test',
  database: env.SURREALDB_DATABASE || 'test',
  username: env.SURREALDB_USERNAME || 'root',
  password: env.SURREALDB_PASSWORD || 'root',
  initdb: env.SURREALDB_SURFACE_INITDB !== 'false',
};

// @Module is a plain function, apply it from plain js
// (note: the decorator returns undefined, so apply it to a named class instead of assigning its return value)
const HostModule = class SurfaceHostModule {};
Module({
  imports: [SurrealDbModule.forRoot(config)],
})(HostModule);

const results = [];
let current = '';
const check = async (name, fn) => {
  current = name;
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail !== undefined ? `  ${String(detail).slice(0, 100)}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
    console.log(`FAIL  ${name}  =>  ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}`);
  }
};

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

async function main() {
  const app = await NestFactory.createApplicationContext(HostModule, { logger: ['error', 'warn'] });
  const svc = app.get(SurrealDbService);
  const P = config.password;
  const scratch = 'surface_test';
  const edge = 'surface_edge';

  console.log(`# target ${config.url} ns=${config.namespace} db=${config.database} user=${config.username}`);

  // the service connects asynchronously from its constructor, wait for it before probing
  await check('wait for connection (constructor initSurrealDb)', async () => {
    const deadline = Date.now() + 20000;
    while (!svc.getIsConnected()) {
      if (Date.now() > deadline) throw new Error(`timeout, status: ${svc.getStatus()}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    return svc.getStatus();
  });

  await check('version()', async () => {
    const v = await svc.version();
    assert(v?.version, 'no version');
    return v.version;
  });

  await check('health()', async () => {
    await svc.health();
    return 'ok';
  });

  await check('status()/isConnected()', () => {
    assert(svc.getIsConnected() === true, 'not connected');
    return svc.getStatus();
  });

  if (config.initdb) {
    await check('import initdb.surql', async () => {
      const surql = await readFile(new URL('../../../initdb.surql', import.meta.url), 'utf8');
      await svc.import(surql);
      return 'imported';
    });
  }

  await check('query INFO FOR DB', async () => {
    const res = await svc.query('INFO FOR DB');
    assert(res?.[0]?.accesses?.account, 'account access missing (import initdb first)');
    return 'account access present';
  });

  await check('run fn::greet', async () => {
    const res = await svc.run('fn::greet', ['surface']);
    assert(res === 'Hello, surface!', `unexpected: ${JSON.stringify(res)}`);
    return res;
  });

  await check('query DDL scratch tables', async () => {
    await svc.query(`DEFINE TABLE IF NOT EXISTS ${scratch} SCHEMALESS; DEFINE TABLE IF NOT EXISTS ${edge} SCHEMALESS`);
    return 'defined';
  });

  let idA;
  await check('create table', async () => {
    const res = await svc.create(scratch, { name: 'a' });
    idA = Array.isArray(res) ? res[0]?.id : res?.id;
    assert(idA, `no id: ${JSON.stringify(res)}`);
    return String(idA);
  });

  await check('create record id', async () => {
    const res = await svc.create(`${scratch}:fixed`, { name: 'fixed' });
    assert(res?.id, `no id: ${JSON.stringify(res)}`);
    return String(res.id);
  });

  await check('select table', async () => {
    const res = await svc.select(scratch);
    assert(Array.isArray(res) && res.length >= 2, `unexpected: ${JSON.stringify(res).slice(0, 80)}`);
    return `${res.length} rows`;
  });

  await check('select record', async () => {
    const res = await svc.select(`${scratch}:fixed`);
    assert(res?.name === 'fixed', `unexpected: ${JSON.stringify(res)}`);
    return String(res.id);
  });

  await check('select builder options', async () => {
    const res = await svc.select(scratch, { where: 'name = "fixed"', limit: 1, fields: ['id'] });
    assert(Array.isArray(res) && res.length === 1, `unexpected: ${JSON.stringify(res)}`);
    return `${res.length} row`;
  });

  await check('update merge', async () => {
    const res = await svc.update(`${scratch}:fixed`, { extra: true }, 'merge');
    assert(res?.extra === true && res?.name === 'fixed', 'merge did not preserve fields');
    return 'merged';
  });

  await check('upsert merge (create-or-update)', async () => {
    const res = await svc.upsert(`${scratch}:upserted`, { name: 'up' }, 'merge');
    assert(res?.name === 'up', `unexpected: ${JSON.stringify(res)}`);
    return String(res.id);
  });

  await check('insert many', async () => {
    const res = await svc.insert(scratch, [{ name: 'b' }, { name: 'c' }]);
    assert(Array.isArray(res) && res.length === 2, `unexpected: ${JSON.stringify(res)}`);
    return `${res.length} records`;
  });

  await check('relate single (surrealql fallback)', async () => {
    const res = await svc.relate(`${scratch}:fixed`, edge, `${scratch}:upserted`, { since: '2026-01-01' });
    const rows = Array.isArray(res) ? res : [res];
    assert(rows.length === 1 && rows[0]?.in, `unexpected: ${JSON.stringify(res).slice(0, 100)}`);
    return `edge ${rows[0].id}`;
  });

  await check('relate fan-out arrays', async () => {
    const res = await svc.relate([`${scratch}:fixed`, `${scratch}:upserted`], edge, [`${scratch}:fixed`, `${scratch}:upserted`]);
    const rows = Array.isArray(res) ? res : [res];
    assert(rows.length === 4, `expected 4 edges, got ${rows.length}`);
    return `${rows.length} edges`;
  });

  await check('query select', async () => {
    const res = await svc.query(`SELECT * FROM ${scratch} WHERE name = "b"`);
    assert(res?.[0]?.length === 1, `unexpected: ${JSON.stringify(res)}`);
    return `${res[0].length} row`;
  });

  await check('query mode responses', async () => {
    const res = await svc.query(`SELECT * FROM ${scratch}`, undefined, 'responses');
    assert(Array.isArray(res) && res[0]?.result !== undefined, 'no responses shape');
    return 'responses shape ok';
  });

  await check('transaction begin/query/commit', async () => {
    const tx = await svc.beginTransaction();
    await tx.query(`CREATE ${scratch}:txset SET name = $name`, { name: 'tx' });
    await tx.commit();
    const res = await svc.select(`${scratch}:txset`);
    assert(res?.name === 'tx', `unexpected: ${JSON.stringify(res)}`);
    return 'committed';
  });

  await check('set/get/unset session variable', async () => {
    await svc.set('migVar', 42);
    const value = await svc.get('migVar');
    await svc.unset('migVar');
    const after = await svc.get('migVar');
    assert(value === 42, `get after set: ${JSON.stringify(value)}`);
    assert(after === null, `get after unset: ${JSON.stringify(after)}`);
    return 'set -> 42, unset -> null';
  });

  let tokens;
  await check('signup record access', async () => {
    tokens = await svc.signup({
      namespace: config.namespace,
      database: config.database,
      access: 'account',
      variables: { username: `surface_${Date.now()}`, password: 'Passw0rd!', marketing: true, tags: ['surface'] },
    });
    assert(tokens?.access, 'no access token');
    return 'tokens received';
  });

  await check('authenticate + auth()', async () => {
    await svc.authenticate(tokens.access);
    const user = await svc.auth();
    assert(user && String(user.id).startsWith('user:'), `unexpected: ${JSON.stringify(user)}`);
    return String(user.id);
  });

  await check('invalidate + root signin restore', async () => {
    await svc.invalidate();
    const t = await svc.signin({ username: config.username, password: P });
    assert(t?.access, 'root signin failed');
    return 'root session restored';
  });

  await check('live + kill', async () => {
    const sub = await svc.live(scratch);
    assert(sub?.id, 'no live id');
    await sub.kill();
    return 'killed';
  });

  await check('export', async () => {
    const dump = await svc.export();
    assert(typeof dump === 'string' && dump.length > 0, 'empty export');
    return `len=${dump.length}`;
  });

  await check('cleanup', async () => {
    await svc.delete(edge);
    await svc.delete(scratch);
    await svc.query("DELETE user WHERE string::starts_with(username, 'surface_')");
    return 'cleaned';
  });

  await svc.close();
  await app.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n# ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FATAL (${current || 'boot'}):`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
