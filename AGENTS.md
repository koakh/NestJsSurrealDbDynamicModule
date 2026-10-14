# AGENTS.md

## Repo layout

Yarn 4 workspaces monorepo (`packageManager: yarn@4.5.3`, nodeLinker: node-modules).

- `packages/app-lib` — `@koakh/nestjs-surrealdb` v0.2.0: the published NestJS dynamic module wrapping surrealdb.js **v2** (entry `src/index.ts`, core in `src/surrealdb/`)
- `packages/app-rst` — `@koakh/nestjs-surrealdb-rest-demo`, REST consumer/demo app (port 3030)
- `packages-wip/` — app-gql, app-lib-gql, dataloader, tutorial-graphql: NOT part of the workspace. Root scripts `start:app-gql`, `start:tutorial-graphql`, `docker:app-gql:*` and README references to `packages/app-gql` etc. are stale.
- Root `client.http` — ready-made REST requests against app-rst covering the full SDK v2 proxy surface (health, sessions, transactions, live queries, gql, import/export, CRUD).

## Package manager rules (important)

- Use Yarn only. `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `package-lock.json` are committed but stale — never run npm/pnpm installs.
- Always `yarn install --mode=skip-build`. Plain install can loop forever building deps (app-lib has a `prepare` build script). Same flag when adding packages: `yarn add <pkg> --mode=skip-build`.

## Dev loop

Requires Node **>= 22** (SDK v2 uses the global `WebSocket` for `ws://`) and SurrealDB **v3** at `ws://127.0.0.1:8001/rpc` (docker compose maps the container to host port **8001** — port 8000 is taken by the honcho stack on this machine), namespace/database `test`, user/pass `root/root`. The local `surreal` CLI (v3, required — v1 CLI refuses v3 servers) installs to `~/.local/bin` via `yarn surreal:install`. All root `surreal:*` scripts default to `${SURREALDB_PORT:-8001}`.

```shell
yarn surreal:docker     # or: yarn surreal (local binary, rocksdb://database)
yarn surreal:initdb     # imports initdb.sql; required for signup/signin endpoints
yarn app-lib:dev        # terminal 1: tsc watch for the lib
yarn start:app-rst      # terminal 2: nodemon debug on port 3030
```

- app-rst resolves `@koakh/nestjs-surrealdb` as `workspace:^` (symlinks are hoisted to root `node_modules/@koakh/`, not per-package); its nodemon also watches `../app-lib/src`, so lib edits reload the app.
- **After deleting `packages/app-lib/dist`, you MUST also delete `packages/app-lib/tsconfig.tsbuildinfo`** — `incremental: true` makes tsc silently skip emit when the state file survives, so `yarn build` "succeeds" with no output and no dist (app then fails with `Cannot find module '@koakh/nestjs-surrealdb'`).
- If workspace links go missing: `rm -f .yarn/install-state.gz && rm -rf node_modules packages/*/node_modules && yarn install --mode=skip-build` — yarn will NOT relink from a cached install state.
- `start:app-rst` first runs `kill-port` (`sudo fuser -k 3030/tcp` — needs sudo) and exposes `node --inspect` on 127.0.0.1:9232. VS Code: use the "Launch via Yarn" config.
- app-rst env defaults are built into `src/config/configuration.ts` (defaults to `ws://127.0.0.1:8001/rpc`) — no `.env` needed for the default local stack (`.env.sample` points at an unrelated external stack). Override via `SURREALDB_URL/NAMESPACE/DATABASE/USERNAME/PASSWORD`, `HTTP_SERVER_PORT`.
- SurrealDB v3 requires `OPTION IMPORT;` as the first statement of any import — `initdb.sql` has it, and the REST `POST /surrealdb/import` auto-prepends it. v3 CLI renamed `--conn` to `--endpoint`.

## Tests

- Unit specs exist only in app-rst: `cd packages/app-rst && yarn test` (scaffold-level, no DB needed; controllers/services are mocked with `{ provide: SurrealDbService, useValue: {} }`).
- app-lib has no test setup (scripts and deps removed in v0.2.0).
- e2e (`yarn test:e2e` in app-rst) boots the full AppModule and needs a running SurrealDB.
- Lint/format: both packages use eslint + prettier (app-lib migrated from deprecated tslint to flat `eslint.config.mjs` in v0.2.0).

## Architecture notes (app-lib ↔ app-rst wiring)

- `SurrealDbModule` must stay `@Global()` — removing it breaks DI resolution of `SurrealDbService`.
- Built on `ConfigurableModuleBuilder` from `@nestjs/common` (v0.2.0 replaced `@golevelup/nestjs-modules`); consumers call `SurrealDbModule.forRootAsync({...})` — no class-ref first argument. The options token is pinned with `optionsInjectionToken: 'SURREALDB_MODULE_OPTIONS'` (auto-generating from `moduleName` would produce `SURREAL_DB_MODULE_OPTIONS`).
- SDK v2 specifics handled in `SurrealDbService`: table strings → `new Table(...)`, `table:id` → `StringRecordId`; `update/upsert` take a `mode: content|merge|patch`; SurrealDB v3 requires `OPTION IMPORT;` first on imports (auto-prepended); `run(name, args)` must never pass an explicit `undefined` version.
- The consumer's `forRootAsync` factory injects `ConfigService` + `UserService`, so it must `imports: [AppModule, UserModule]` and provide/export the `APP_SERVICE` token — read the comments in `packages/app-rst/src/app.module.ts` before touching this wiring.
- `SurrealDbController` from the lib is opt-in: the consumer adds it to its own `controllers` array.

## Publishing app-lib

```shell
yarn app-lib:patch     # build + npm version patch; then bump the version in consumer apps and yarn install --mode=skip-build
yarn app-lib:publish   # npm publish — yarn publish fails with ENEEDAUTH
```

- `workspace:^` deps can break `npm version` with EINVALIDPACKAGENAME — workaround documented in NOTES.md.

## Other docs

- `README.md` — full environment setup and SurrealDB install instructions
- `TLDR.md` — quick-start command sequence
- `NOTES.md` — hard-won gotchas (DI/@Global, GraphQL generics, publish errors)
