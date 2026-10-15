# @koakh/nestjs-surrealdb-rest-demo

REST consumer demo app for [`@koakh/nestjs-surrealdb`](https://www.npmjs.com/package/@koakh/nestjs-surrealdb) — wires the dynamic module end-to-end (ConfigService + `UserService` injection, opt-in `SurrealDbController`) and exposes the **full surrealdb.js v2 proxy surface over REST**.

- NestJS 11, port **3030**, resolves the lib as `workspace:^`
- part of the monorepo, see the [root README](../../README.md) for the full dev environment

## Run

requires SurrealDB **v3** at `ws://127.0.0.1:8001/rpc` (see root README `yarn surreal:docker` + `yarn surreal:initdb`) and the lib watch build (`yarn app-lib:dev`), then from the repo root:

```shell
$ yarn start:app-rst
[Nest] LOG [NestApplication] Application is running on: http://[::1]:3030
[Nest] LOG [NestApplication] using surrealDb host: ws://127.0.0.1:8001/rpc
```

`start:app-rst` first kills port 3030 (`sudo fuser -k 3030/tcp`, needs sudo) and exposes `node --inspect` on `127.0.0.1:9232`.

## Environment Variables

all optional, defaults are built into [`src/config/configuration.ts`](src/config/configuration.ts) for the default local stack (`.env.sample` points at an unrelated external stack):

| variable | default |
| --- | --- |
| `HTTP_SERVER_PORT` | `3030` |
| `SURREALDB_URL` | `ws://127.0.0.1:8001/rpc` |
| `SURREALDB_NAMESPACE` | `test` |
| `SURREALDB_DATABASE` | `test` |
| `SURREALDB_USERNAME` | `root` |
| `SURREALDB_PASSWORD` | `root` |

## Endpoints

local demo endpoints:

| endpoint | description |
| --- | --- |
| `GET /` | hello from the local `AppService` (`APP_SERVICE` token demo) |
| `GET /config` | the resolved `SurrealDbModuleOptions` |
| `GET /user-service` | calls the consumer `UserService` through the lib (`getUserFindOneByField`) |
| `GET /db/user-service` | same, from a feature module |
| `GET /db/select/:thing` | feature-module select demo |

plus the full lib proxy surface under `surrealdb/` (connection, sessions, transactions, import/export, auth, `query`/`gql`/`run`, user-defined APIs, live queries, CRUD) — see the [lib README controller table](../app-lib/README.md#opt-in-rest-controller) and try it with the ready-made root [`client.http`](../../client.http).

> `signup`/`signin` require the `user` table and `account` record access method from the root `initdb.surql` (`yarn surreal:initdb`)

## How it wires the lib

the interesting bits (with the hard-won comments):

- [`src/app.module.ts`](src/app.module.ts) — `SurrealDbModule.forRootAsync({...})` with `ConfigService` + `UserService` injection, `imports: [AppModule, UserModule]`, `APP_SERVICE` token provide/export, `SurrealDbController` in `controllers`
- [`src/user/user.service.ts`](src/user/user.service.ts) — consumer `UserServiceAbstract` implementation
- [`src/db/db.module.ts`](src/db/db.module.ts) — feature module consuming the `@Global()` `SurrealDbService` without re-importing the module

## Test

```shell
$ yarn test        # unit specs, scaffold-level, no DB needed
$ yarn test:e2e    # boots the full AppModule, needs a running SurrealDB
```

## Docker

```shell
$ yarn docker:build
$ yarn docker:up
$ yarn docker:down
```
