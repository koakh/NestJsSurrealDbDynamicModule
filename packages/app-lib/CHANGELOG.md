# Changelog

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
