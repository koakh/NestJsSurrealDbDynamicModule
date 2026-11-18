# NOTES

hard-won gotchas and lessons from building and migrating this stack, newest era first.

**Contents**

- [Foundational](#foundational)
- Modern era (v0.2.0+)
  - [SDK v2 migration lessons](#sdk-v2-migration-lessons-2026-10-surrealdbjs-110---211--server-v316)
  - [SurrealDB 4 migration lessons](#surrealdb-4-migration-lessons-2026-11-server-316---400--sdk-211---222)
  - [v4 CLI command tree](#v4-cli-command-tree-2026-11)
  - [Opaque record-access errors + idempotent initdb](#opaque-record-access-errors--idempotent-initdb-2026-11-v030)
  - [Pre-publish audit lessons](#pre-publish-audit-lessons-2026-11-v030)
  - [Dev-scripts boot failures](#dev-scripts-boot-failures-2026-11-v030)
  - [Publishing lessons (still current)](#publishing-lessons-still-current)

> the legacy v0.1.x GraphQL-era notes were removed with the deprecated packages — the git tag `before-deprecate-graphql` preserves them.

## Foundational

AFTER SO MANY HOURS the start solving is using `@Global` on `SurrealDbModule`

- `packages/app-lib/src/surrealdb/surrealdb.module.ts`

```ts
// required @Global() to override errors of 
// ERROR [ExceptionHandler] Nest can't resolve dependencies of the DbService (?). Please make sure that the argument SurrealDbService at index [0] is available in the DbModule context.
@Global()
@Module({
  providers: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders,
```

## SDK v2 migration lessons (2026-10, surrealdb.js 1.1.0 -> 2.1.1 / server v3.1.6)

- `tsc` `incremental: true` + deleted `dist` = silent no-op build: `tsconfig.tsbuildinfo` sits next to the tsconfig (not in dist) and makes `yarn build` "succeed" with zero output. Always `rm tsconfig.tsbuildinfo` together with `dist`.
- yarn 4 will NOT relink `node_modules` from a cached install state: after deleting links, run `rm -f .yarn/install-state.gz && rm -rf node_modules packages/*/node_modules && yarn install --mode=skip-build`.
- duplicate lib copies (per-package vs hoisted `node_modules/@koakh`) produce misleading Nest DI errors (`can't resolve SURREALDB_MODULE_OPTIONS`) even when `dist` and the token are correct — clean reinstall fixes it.
- `ConfigurableModuleBuilder` auto-token from `moduleName: 'SurrealDb'` generates `SURREAL_DB_MODULE_OPTIONS` (camel split), not `SURREALDB_MODULE_OPTIONS` — pin it with `optionsInjectionToken`.
- SurrealDB v3 requires `OPTION IMPORT;` as the first statement of any import (SDK auto-prepended in our service; `initdb.surql` includes it).
- v3 CLI renamed `--conn` to `--endpoint`; a v1 CLI refuses v3 servers outright (version range check). The official installer script builds a stale v1-era CDN URL (403) — download directly from `https://download.surrealdb.com/vX.Y.Z/surreal-vX.Y.Z.linux-amd64.tgz` (note the double `v`).
- SDK v2 quirks: `upsert` must not pre-check existence; `run(name, args)` must never pass an explicit `undefined` version (breaks overload dispatch); `health()` rpc is not available over WS on v3.1.6 (fallback to connection status).
- `closeSession()` on the primary session is equivalent to `close()` — kills the shared connection, auto-reconnect does not apply to deliberate closes.

## SurrealDB 4 migration lessons (2026-11, server 3.1.6 -> 4.0.0 / SDK 2.1.1 -> 2.2.2)

- SDK `connect()` credentials must be nested (`authentication: { username, password }`); passing them flat at the top level of the options is **silently ignored** and the session stays anonymous (only permission errors surface later, ex `INFO FOR DB` -> `Anonymous access not allowed`). the lib was already correct; raw-SDK probes were not.
- SurrealDB 4 removed the `health` rpc (`Method not found` on SDK 2.1.1; SDK 2.2.2 makes `db.health()` a client-side check returning `undefined`). the service now probes with `version()` round-trip.
- SurrealDB 4 broke the `relate` rpc argument marshalling (`Cannot execute RELATE statement where property 'out' is: 'follows'`), with both SDK 2.1.1 and 2.2.2. workaround: SurrealQL `RELATE $from->edge->$to CONTENT $data` with `StringRecordId` bindings — works for single and fan-out (array) targets.
- ISO GraphQL is gone in v4 (`db.gql()` -> SurrealQL parse error `Unexpected token QUERY`), removed `gql()` / `POST /surrealdb/gql` from the lib.
- the SurrealQL `version()` function is gone in v4 (parse error); the rpc `version()` still returns `{ version: "surrealdb-4.0.0" }`.
- v4 removed the `file://` storage scheme (`The file:// scheme is no longer supported; use surrealkv:// instead`) — crashed a container started with `start file:/data.srdb`.
- the official docker image reads env `SURREAL_USER` / `SURREAL_PASS` (plus `SURREAL_BIND`, `SURREAL_PATH`); app-style `SURREALDB_USERNAME` / `SURREALDB_PASSWORD` names are NOT read, and a v4 container started without credentials defines **no users at all** (every signin fails `InvalidAuth`, anonymous is denied).
- HTTP basic auth to `/sql` failed even with correct credentials during testing; header auth (`SurrealDB-User`/`SurrealDB-Pass`) reached the query parser. the ws rpc path (what the SDK uses) is the reliable transport.
- Nest `createApplicationContext` with `{ logger: false }` **silently `process.exit(1)`-s** on boot errors (ExceptionsZone DEFAULT_TEARDOWN); keep at least `logger: ['error', 'warn']` in scripts. also `require('reflect-metadata')` before importing the built lib from plain js, and don't assign the `@Module(...)` decorator return value (it returns undefined).
- `DELETE <table> WHERE username STARTS WITH 'x'` was a v4 parse error (`Unexpected token an identifier, expected Eof`); `string::starts_with(username, 'x')` is the working form. `DELETE` removes records, not the table definition (use `DEFINE TABLE IF NOT EXISTS` in repeatable scripts).

## v4 CLI command tree (2026-11)

- SurrealDB 4 moved the whole CLI under the `db` subcommand: `surreal start|import|export|sql|version` -> `surreal db start|import|export|sql|version` (old forms still run but print deprecation warnings). **all flags are unchanged** (`--endpoint`, `--user`/`--pass` aliases, `--ns`/`--db` aliases, `--auth-level`).
- new v4 CLI goodies: `surreal db is-ready` (server readiness probe) and `surreal db validate` (validate SurrealQL files).
- `surreal db import <file>` takes the file as a **positional** argument (same as before), and auth also reads from env (`SURREAL_USER`, `SURREAL_PASS`, `SURREAL_NAMESPACE`, `SURREAL_DATABASE`).
- **same tag, different CLI**: the `surrealdb/surrealdb:v4.0.1` docker image binary does NOT have the `db` subcommand tree, while the standalone 4.0.1 CLI from download.surrealdb.com does. consequence: docker compose keeps the plain `start` command (image-native), workstation scripts use the `surreal db *` forms — both verified working together.

## Opaque record-access errors + idempotent initdb (2026-11, v0.3.0)

- SurrealDB 4 wraps record access clause failures opaquely: a UNIQUE violation inside the SIGNUP clause surfaces as `The record access signup query failed` with no details (v3 showed the inner error). run the clause manually as a query to see the real cause, ex `Database index idx_username already contains a conflicting value in another record`.
- `initdb.surql` now starts with `REMOVE DATABASE IF EXISTS test;` — **every `yarn surreal:initdb` run wipes the whole database** and re-imports the schema from scratch (fully idempotent: no leftover users violating `idx_username` on the next signup). verified working under `OPTION IMPORT` via both the SDK `import()` and the CLI `surreal db import`.
- demo app: `/db/signup` maps the opaque failure to a **409 Conflict** with an explicit "username already taken" message (probes `user.idx_username` on failure), `/db/signin` maps failures to a plain **401** `invalid username or password`.
- SurrealML is gone in v4: `exportModel()` fails client-side with `UnavailableFeatureError: ... does not support the feature: surreal-ml (>= undefined < 4.0.0)` — the SDK feature table caps it below 4.0.0. removed the method/endpoint alongside `gql` (same removal category: server-dropped features).
- official v4 context (release notes): SurrealML was removed wholesale (`/ml` routes, `DEFINE MODEL`, `ml::` calls, SDK model import/export; a 3.x datastore holding a model refuses to start) — the replacement is calling externally-served models via `http::post()` from SurrealQL or Surrealism extensions. ISO GraphQL was an experimental 3.x feature (`--allow-experimental gql`) that 4.0 cut instead of graduating. also: SurrealKV is the only storage engine (why `file://` died), one bytecode executor for every statement, CBOR v2 protocol, and the 3.x -> 4.0 datastore upgrade is opt-in (`SURREAL_EXPERIMENTAL_UPGRADE_FROM_3X=true`) and one-way.

## Pre-publish audit lessons (2026-11, v0.3.0)

- **`export declare class` + decorators compiles to an empty file** — `declare` tells tsc the class exists elsewhere, so nothing is emitted: no runtime class, no decorator metadata. every DTO in the lib was `declare` since v0.1.x, so **class-validator never ran**. fix: plain `export class`.
- **destructured `@Body()` params kill ValidationPipe validation** — `@Body() { url }: ConnectDto` makes tsc emit `Object` as `design:paramtypes`, the pipe gets no metatype and skips validation/whitelist entirely. fix: whole-DTO params (`@Body() dto: ConnectDto` + `dto.url`).
- app-rst `nest build` silent no-op variant: the stale-incremental gotcha also applies to `tsconfig.build.tsbuildinfo` (not just `tsconfig.tsbuildinfo`) — remove both with `dist`.
- `pkill -f <pattern>` in a shell whose own command line contains the pattern kills the shell itself — kill by port (`ss -tlnp`) instead.
- **`yarn up` can rewrite package.json before finishing** — a timed-out/killed `yarn up` had already bumped every range to the latest majors (NestJS 12 etc.) mid-run, which only surfaced later as jest failing to load the v12 ESM layout (`Tests: 0 total`). if an upgrade run is interrupted, `git diff package.json` before trusting anything.

## Dev-scripts boot failures (2026-11, v0.3.0)

- `nest start` (ex `yarn start:dev`) with `nest-cli.json` `"deleteOutDir": true` **deletes `dist/` at startup**, but tsc `"incremental": true` keeps its state in `tsconfig.build.tsbuildinfo` next to the tsconfig (NOT in dist) — when the state says "up to date" the watch compile emits **zero files** and the spawned `node dist/main` dies with `MODULE_NOT_FOUND`. the same no-op hits plain `yarn build` after a manual `dist` deletion. fix: removed `"incremental": true` from both package tsconfigs (compile cost here is negligible) — plus `rm -f *.tsbuildinfo` when touching this.
- `start:debug` connected to a dead endpoint because the local (gitignored) `packages/app-rst/.env` still pointed at an old stack — with `SURREALDB_INIT_SURREAL_DB_THROW_ERROR=false` now actually wired the app boots and retries in the background instead of crashing, which is the desired dev behavior.

## Publishing lessons (still current)

### npm ERR! need auth This command requires you to be logged in to https://registry.yarnpkg.com/

```shell
$ yarn start:app-lib:publish
...
npm ERR! code ENEEDAUTH
npm ERR! need auth This command requires you to be logged in to https://registry.yarnpkg.com/
npm ERR! need auth You need to authorize this machine using `npm adduser`

npm ERR! A complete log of this run can be found at:
npm ERR!     /home/mario/.npm/_logs/2022-10-11T21_10_15_256Z-debug-0.log
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```

to fix just use `npm publish`

```shell
$ cd packages/app-lib
$ npm publish
# outcome
npm notice Publishing to https://registry.npmjs.org/
+ @koakh/nestjs-surrealdb@0.1.5
```

### Fix: npm error code EINVALIDPACKAGENAME

```shell
$ npm run version:patch
v0.1.18
npm error code EINVALIDPACKAGENAME
npm error Invalid package name "// in case of error: npm error Unsupported URL Type "workspace:": workspace:^, comment bellow line and use npm version patch" of package "// in case of error: npm error Unsupported URL Type "workspace:": workspace:^, comment bellow line and use npm version patch@": name can only contain URL-friendly characters.
```

- `packages/app-rst/package.json`

```json
"dependencies": {
    "// in case of error: npm error Unsupported URL Type \"workspace:\": workspace:^, remove this line and bellow line and use npm version:patch": "",
    // "@koakh/nestjs-surrealdb": "workspace:^",
}
```

fix removing both lines, 

after this both commands works flawless `version:patch` and `version:publish`
