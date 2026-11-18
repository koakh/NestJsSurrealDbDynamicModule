# @koakh/nestjs-surrealdb-rest-demo

REST consumer demo app for [`@koakh/nestjs-surrealdb`](https://www.npmjs.com/package/@koakh/nestjs-surrealdb) — wires the dynamic module end-to-end (ConfigService + `UserService` injection, opt-in `SurrealDbController`, `controllerGuard`) and showcases the **full lib surface over REST**.

- NestJS 11, port **3030**, resolves the lib as `workspace:^`
- SurrealDB server **v4** baseline (verified `4.0.0`/`4.0.1`), surrealdb.js `^2.2.2`
- part of the monorepo, see the [root README](../../README.md) for the full dev environment

## Run

requires SurrealDB **v4** with the initdb schema imported (root README: `yarn surreal:docker` + `yarn surreal:initdb`, or any v4 endpoint via env vars) and the lib watch build (`yarn app-lib:dev`), then from the repo root:

```shell
$ yarn start:app-rst
[Nest] LOG [NestApplication] Application is running on: http://[::1]:3030
[Nest] LOG [NestApplication] using surrealDb host: ws://127.0.0.1:8001/rpc
```

`start:app-rst` first kills port 3030 (`sudo fuser -k 3030/tcp`, needs sudo) and exposes `node --inspect` on `127.0.0.1:9232`.

## Environment Variables

all optional, defaults are built into [`src/config/configuration.ts`](src/config/configuration.ts) for the default local stack:

| variable | default | description |
| --- | --- | --- |
| `HTTP_SERVER_PORT` | `3030` | REST app port |
| `HTTP_SERVER_HOST` | `0.0.0.0` | bind address (`0.0.0.0` required for docker port mapping) |
| `SURREALDB_URL` | `ws://127.0.0.1:8001/rpc` | SurrealDB RPC endpoint |
| `SURREALDB_NAMESPACE` | `test` | namespace |
| `SURREALDB_DATABASE` | `test` | database |
| `SURREALDB_USERNAME` | `root` | system user |
| `SURREALDB_PASSWORD` | `root` | system user password |
| `SURREALDB_INIT_SURREAL_DB` | - | set `false` to skip the connect on boot |
| `SURREALDB_INIT_SURREAL_DB_THROW_ERROR` | - | set `false` to log-and-continue on boot errors |
| `SURREALDB_CONTROLLER_GUARD_KEY` | - | when set, every `/surrealdb/*` endpoint requires the `x-api-key` header to match |
| `PROCESS_GUARD` | enabled | `false` restores node's crash-fast default on unhandled errors (use under a supervisor) |

## Endpoints

local demo endpoints:

| endpoint | description |
| --- | --- |
| `GET /` | hello from the local `AppService` (`APP_SERVICE` token demo) |
| `GET /config` | the resolved `SurrealDbModuleOptions` (**password redacted**) |
| `GET /user-service` | calls the consumer `UserService` through the lib (`getUserFindOneByField`) |

showcase endpoints ([`src/db/db.controller.ts`](src/db/db.controller.ts)) — each one exercises a lib capability the way a real consumer would:

| endpoint | showcases |
| --- | --- |
| `GET /db/user-service` | consumer `UserService` through the lib, from a feature module |
| `GET /db/select/:thing` | feature-module select |
| `POST /db/signup` `{username, password, marketing?, tags?}` | record-access **signup** (initdb `account`) → `Tokens` |
| `POST /db/signin` `{username, password}` | record-access **signin** → `Tokens` |
| `POST /db/signout` | **logout**: invalidate the session, then restore the root session so the demo keeps working |
| `GET /db/auth?token=` | the authenticated record user (`$auth`), optional token authenticate |
| `GET /db/greet/:name` | user-defined function `run('fn::greet')` |
| `POST /db/person` `{title, name: {first, last}, marketing?}` | create with a **nested validated DTO** |
| `GET /db/person/:id` | select by record id |
| `POST /db/transaction-demo` | `beginTransaction` → query → `commit` in one call |
| `POST /db/live-demo/:thing` | live query + write + **captured events** + kill, self-contained |

plus the full lib proxy surface under `surrealdb/` (connection, sessions, transactions, import/export, auth, `query`/`run`, user-defined APIs, live queries, CRUD) — see the [lib README controller table](../app-lib/README.md#opt-in-rest-controller) and try everything with the ready-made root [`client.http`](../../client.http).

> `signup`/`signin` and `fn::greet` require the `user` table, `account` record access method and `fn::greet` function from the root `initdb.surql` (`yarn surreal:initdb`)

## How it wires the lib

the interesting bits (with the hard-won comments):

- [`src/app.module.ts`](src/app.module.ts) — `SurrealDbModule.forRootAsync({...})` with `ConfigService` + `UserService` injection, `imports: [AppModule, UserModule]`, `APP_SERVICE` token provide/export, `SurrealDbController` in `controllers`, env-driven `controllerGuard`
- [`src/user/user.service.ts`](src/user/user.service.ts) — consumer `UserServiceAbstract` implementation
- [`src/db/db.module.ts`](src/db/db.module.ts) — feature module consuming the `@Global()` `SurrealDbService` without re-importing the module
- [`src/main.ts`](src/main.ts) — `ValidationPipe` (`transform`/`whitelist`/`forbidNonWhitelisted`), `AllExceptionsFilter`, `enableShutdownHooks()`

## Test

```shell
$ yarn test        # unit specs, no DB needed
$ yarn test:e2e    # DB-backed e2e: boots the full AppModule against a live SurrealDB v4
```

the e2e suite covers the hello/config-redaction endpoints, health/version, person CRUD + validation 400s, `fn::greet`, transaction demo, live-demo event capture, the record-access auth flow and the `controllerGuard` 403/200 differential. it points at the default local stack, override the target with the standard env vars:

```shell
$ SURREALDB_URL=ws://192.168.1.103:9001/rpc SURREALDB_PASSWORD=... yarn test:e2e
```

when no server is reachable the DB specs log a warning and run as skipped.

## Docker

```shell
$ yarn docker:build   # builds from the REPO ROOT (the yarn workspace must resolve)
$ yarn docker:up      # app + surrealdb v4 (persistent volume, initdb survives restarts)
$ yarn docker:down
```

the image (`koakh/nestjs-surrealdb-rest-demo:0.3.0`) is a 2-stage build: corepack yarn 4 installs the workspace, builds app-lib then the app; the runner ships the dist artifacts + node_modules as non-root `node`. the app container reaches the db by service hostname (`ws://nestjs-surrealdb-rest-surrealdb:8000/rpc`) and boots tolerant (`SURREALDB_INIT_SURREAL_DB_THROW_ERROR=false`) while the db starts. no `.env` is baked into the image (root `.dockerignore`) — every compose value is overridable via `.env`/shell (`${VAR:-default}` substitution, including the db credentials through `SURREALDB_USERNAME`/`SURREALDB_PASSWORD`). note: the persistent volume keeps the root user from the first boot — changing the password later needs `docker compose down -v`.
