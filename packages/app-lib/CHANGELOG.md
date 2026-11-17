# Changelog

## 0.3.0

SurrealDB server migration release: verified against **`v4.0.0`** (docker `surrealdb/surrealdb:v4.0.0`), surrealdb.js `2.1.1` -> `2.2.2`. the full service surface is covered by a new PASS/FAIL surface test (`yarn app-lib:surface`), 28/28 green against a live v4 server.

### Breaking

- `gql()` and REST `POST /surrealdb/gql` removed: SurrealDB 4 dropped ISO GraphQL (server-side parse error) — use `query()` with SurrealQL instead
- `exportModel()` and REST `GET /surrealdb/export-model/:name/:version` removed: SurrealDB 4 dropped SurrealML (the SDK feature table caps it at `< 4.0.0`, calls fail with `UnavailableFeatureError` before reaching the server)
- SurrealQL `version()` function no longer exists on the server: use the service `version()` (rpc, returns `{ version: "surrealdb-4.0.0" }`)

### Changed

- `health()` no longer calls the SDK `health` rpc (removed in v4): it now probes with a `version()` round-trip, same signature, still throws when unreachable
- `relate()` no longer uses the SDK `relate` rpc (v4 broke its argument marshalling, `Cannot execute RELATE statement where property 'out' is: ...`): it runs a SurrealQL `RELATE $from->edge->$to [CONTENT $data]` with bindings instead (single and fan-out, same signature)
- deps: `surrealdb` `^2.1.1` -> `^2.2.2`

### Compatibility notes (operators)

- the `file://` storage scheme is removed in v4, use `surrealkv://`
- the docker image reads credentials from the `SURREAL_USER` / `SURREAL_PASS` env names (ex `SURREALDB_USERNAME` from app configs is not read by the image)
- `initdb.surql` imports cleanly on v4 unchanged (`OPTION IMPORT;` still required, auto-prepended by `import()`)

### Added

- `yarn app-lib:surface` (repo root): boots the real `SurrealDbModule` and drives the full `SurrealDbService` public API against a live server with a PASS/FAIL matrix — the server-migration acceptance gate (env-configurable via `SURREALDB_URL` etc.)
- opt-in `controllerGuard` module option + `SurrealDbControllerGuard`: a request guard applied to every `SurrealDbController` endpoint (default absent = open, back-compatible; `false` -> 403, throw any `HttpException` for custom responses)
- graceful shutdown: `SurrealDbService` implements `OnApplicationShutdown` and closes the connection (requires `app.enableShutdownHooks()` in the consumer bootstrap)

### Security / audit hardening

- **DTO validation was silently dead since v0.1.x** — the DTOs were `export declare class` (compiles to an empty file, no runtime class) and controller params were destructured (`@Body() { url }: ConnectDto` emits `Object` as the paramtype, so the ValidationPipe never saw a metatype). fixed: real emitted DTO classes + whole-DTO `@Body()` params — validation, `whitelist` and `forbidNonWhitelisted` now actually run
- `ConnectDto.url` validates the endpoint scheme against an allowlist (`ws`, `wss`, `http`, `https`, `mem`, `rocksdb`, `surrealkv`, `fdb`, `tikv`), blocking `file://` and arbitrary schemes
- license fixed: package.json `UNLICENSED` -> `MIT` and the MIT `LICENSE` copyright holder corrected
- demo app (app-rst): `GET /config` now redacts the password, `ValidationPipe` enforces `transform`/`whitelist`/`forbidNonWhitelisted`, unexpected errors return a generic 500 message (details stay in logs), Dockerfile base image `node:18-alpine` -> `node:22-alpine` (the lib requires Node >= 22)

### Dependencies

- `yalc` moved from dependencies to devDependencies (consumers no longer install it), unused devDependencies removed (`ts-node`, `tsc-watch`, `tsconfig-paths`, `nodemon`)

## 0.2.0

BREAKING release: surrealdb.js `1.1.0` -> `2.1.1` (SurrealDB server `v2.0.0+`, verified against `v3.1.6`),
`@golevelup/nestjs-modules` replaced by `@nestjs/common` `ConfigurableModuleBuilder`, Node `>= 22` required.

### Breaking

- `SurrealDbModule.forRootAsync(SurrealDbModule, {...})` -> `SurrealDbModule.forRootAsync({...})` (no class-ref first argument)
- module is now built with `ConfigurableModuleBuilder` (`optionsInjectionToken: 'SURREALDB_MODULE_OPTIONS'`)
- REST endpoints removed with the v1 SDK: `/ping`, `/info`, `/let`, `/query-raw`, `/merge`, `/patch`, `/insert-relation`, `/rpc`, `/subscribe-live`, `/unsubscribe-live`, `/kill/:uuid`
- service methods renamed to SDK v2 names: `ping()` -> `health()`, `info()` -> `auth()`, `let()` -> `set()`
- `signup`/`signin`/`authenticate` return `Tokens { access, refresh? }` instead of a bare token string
- `version()` returns `VersionInfo { version }` instead of a string
- `update`/`upsert` take a `mode: 'content' | 'merge' | 'patch'` (default `content`, replaces standalone `merge`/`patch`)

### Added

- connection: `getStatus`, `getIsConnected`, `isFeatureSupported`, `subscribe` (typed connection events)
- sessions: `newSession`, `forkSession`, `sessions`, `closeSession`, `reset`
- transactions: `beginTransaction` -> `SurrealTransaction` with `commit()`/`cancel()`, REST `/transaction/:id/(query|commit|cancel)`
- data: `import` (auto-prepends the v3 required `OPTION IMPORT;`), `exportModel`, `gql` (ISO GraphQL, SurrealDB 3), `/api/*` proxy for user-defined APIs
- live queries: managed `live()` subscriptions + `liveOf(id)`, REST kill via `DELETE /live/:id`
- `select` builder options (`where`, `limit`, `start`, `fields`, `fetch`) as REST query params
- `query` modes: `collect` (default), `json`, `responses` (with stats), `stream`
- automatic reconnect (unlimited attempts, exponential backoff, configurable via module options) and connection lifecycle events logged at debug level
- module options passthrough: `reconnect`, `retry`, `renewAccess`, `versionCheck`
- re-exports from the SDK for TS consumers: `Table`, `RecordId`, `StringRecordId`, `Uuid`, `surql`, `Features`, `Tokens`, `VersionInfo`, ...

### Changed

- deps: removed `@golevelup/nestjs-modules`, `ws`, `babel-core`, `ts-morph`, `tslint` (eslint flat config now); added `tslib`
- peer dependencies declared: `@nestjs/common ^11`, `reflect-metadata ^0.2`
- consumer demo app (app-rst) upgraded to NestJS 11, jest 30, TypeScript 6

## 0.1.x

initial legacy release line (surrealdb.js 1.x), published up to `0.1.5`
