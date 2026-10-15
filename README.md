# README

NestJs SurrealDb Dynamic Module — a yarn 4 workspaces monorepo hosting **`@koakh/nestjs-surrealdb`**, a NestJS dynamic module wrapper on top of [surrealdb.js](https://surrealdb.com/docs/integration/libraries/nodejs) **v2** ([github](https://github.com/surrealdb/surrealdb.js)), plus a REST consumer demo app.

> `@koakh/nestjs-surrealdb` **v0.2.0** · surrealdb.js **^2.1.1** · SurrealDB server **v3** (verified `3.1.6`) · NestJS **11** · Node **>= 22**

- [Project Components](#project-components)
- [Quick Start](#quick-start)
- [Configure Dev Environment](#configure-dev-environment)
- [Install and Run SurrealDb](#install-and-run-surrealdb)
  - [Install SurrealDb CLI](#install-surrealdb-cli)
  - [Start SurrealDb Instance](#start-surrealdb-instance)
  - [Init surrealDb Database](#init-surrealdb-database)
- [Now launch Consumer Apps](#now-launch-consumer-apps)
- [Test and Lint](#test-and-lint)
- [Publishing app-lib](#publishing-app-lib)
- [Package Documentation](#package-documentation)
- [More docs](#more-docs)

## Project Components

| package | description |
| --- | --- |
| [`packages/app-lib`](packages/app-lib) | **`@koakh/nestjs-surrealdb`** — the published NestJS dynamic module (library): `SurrealDbService` proxying the full surrealdb.js v2 surface + opt-in `SurrealDbController` REST endpoints |
| [`packages/app-rst`](packages/app-rst) | **`@koakh/nestjs-surrealdb-rest-demo`** — REST consumer demo app (NestJS 11, port 3030), wires the module end-to-end and exposes the full SDK v2 proxy surface over REST |
| `packages-wip/` | `app-gql`, `app-lib-gql`, `dataloader`, `tutorial-graphql` — legacy GraphQL packages, **NOT part of the yarn workspace** (upgrade to surrealdb.js v2 pending), kept frozen with their legacy READMEs |

this is **just a simple wrapper on top** of [surrealdb.js integration](https://surrealdb.com/docs/integration/libraries/nodejs), check the [github repo](https://github.com/surrealdb/surrealdb.js), and don't forget to give a **star** to the project and integrations, this "surreal dream team" deserve it

## Quick Start

```shell
# node >= 22 required (SDK v2 uses the global WebSocket)
$ git clone https://github.com/koakh/NestJsSurrealDbDynamicModule.git
$ yarn install --mode=skip-build

# term1: surrealdb v3 (compose maps it to host port 8001)
$ yarn surreal:docker
# install the v3 surreal CLI (one time, into ~/.local/bin)
$ yarn surreal:install
# term2: init database (required for signup/signin endpoints)
$ yarn surreal:initdb

# term2: build + watch the lib
$ yarn app-lib:dev

# term3: start the consumer app (defaults to ws://127.0.0.1:8001/rpc)
$ yarn start:app-rst
```

see [TLDR.md](TLDR.md) for the same in short, then read on for the details.

## Configure Dev Environment

requirements **`node >= 22`** and yarn 4 (SDK v2 uses the global `WebSocket`, Node 22+ required)

this project uses yarn workspaces, start by installing yarn and workspace dependencies

- [Installation | Yarn](https://yarnpkg.com/getting-started/install)

> The preferred way to manage Yarn is by-project and through `Corepack`, a tool shipped by default with Node.js. Modern releases of Yarn aren't meant to be installed globally, or from npm.

```shell
$ node -v
v22.14.0
# enable corepack and use the project pinned version
$ corepack enable
$ yarn --version
4.5.3

# install workspace dependencies
# ALWAYS with --mode=skip-build to prevent the annoying infinite loop
# trying to build dependencies (app-lib has a `prepare` build script)
$ yarn install --mode=skip-build
```

### Always use `--mode=skip-build` to add packages to projects

ex

```shell
$ cd packages/app-rst
$ yarn add -D nodemon --mode=skip-build
```

## Install and Run SurrealDb

### Install SurrealDb CLI

first install the SurrealDB **v3** CLI (a v1 CLI refuses v3 servers). full instructions at [SurrealDB | Install](https://surrealdb.com/install)

```shell
# this repo ships an installer script (downloads v3 to ~/.local/bin)
$ yarn surreal:install
```

> NOTE: the official `curl -sSf https://install.surrealdb.com | sh` installer currently builds a stale v1-era CDN url (403). the repo script downloads directly from `https://download.surrealdb.com/v3.1.6/surreal-v3.1.6.linux-amd64.tgz` (note the double `v`)

### Start SurrealDb Instance

- [SurrealDB | Documentation](https://surrealdb.com/docs/start/starting-surrealdb)

```shell
# start surrealdb v3 with docker compose (maps the container to host port 8001;
# port 8000 is taken on this machine by the honcho stack)
$ yarn surreal:docker

# or start with the local binary and rocksdb
$ yarn surreal

# outcome
 .d8888b.                                             888 8888888b.  888888b.
d88P  Y88b                                            888 888  'Y88b 888  '88b
Y88b.                                                 888 888    888 888  .88P
 'Y888b.   888  888 888d888 888d888  .d88b.   8888b.  888 888    888 8888888K.
    'Y88b. 888  888 888P'   888P'   d8P  Y8b     '88b 888 888    888 888  'Y88b
      '888 888  888 888     888     88888888 .d888888 888 888    888 888    888
Y88b  d88P Y88b 888 888     888     Y8b.     888  888 888 888  .d88P 888   d88P
 'Y8888P'   'Y88888 888     888      'Y8888  'Y888888 888 8888888P'  8888888P'

2026-10-15T11:47:45.498218Z  INFO surreal::env: Running 3.1.6 for linux on x86_64
2026-10-15T11:47:45.499027Z  INFO surrealdb::core::kvs::ds: Starting kvs store at rocksdb://database
2026-10-15T11:47:45.546100Z  INFO surrealdb::core::kvs::ds: Started kvs store at rocksdb://database
2026-10-15T11:47:45.554246Z  INFO surreal::net: Listening for a system shutdown signal.
2026-10-15T11:47:45.554092Z  INFO surreal::net: Started web server on 0.0.0.0:8001
```

all root `surreal:*` scripts default to `${SURREALDB_PORT:-8001}`. the local `surreal` CLI must be **v3** (a v1 CLI refuses v3 servers), check with `surreal version`.

### Init surrealDb Database

import the `initdb.surql` (defines the schemafull `user` table, the `account` record access method and a `fn::greet` test function — required for the `signup`/`signin` endpoints)

```shell
# import schemafull
$ yarn surreal:initdb
# outcome
[2026-10-15 23:07:01] INFO  surrealdb::cli The SQL file was imported successfully

# check info for db (note: v3 CLI uses --endpoint, v1 used --conn)
$ echo "INFO FOR DB;" | surreal sql --json --hide-welcome --pretty --endpoint http://localhost:8001 --user root --pass root --ns test --db test
-- Query 1 (execution time: 609.242µs
{
  "accesses": {
    "account": "DEFINE ACCESS account ON DATABASE TYPE RECORD SIGNUP (CREATE user SET username = $username, password = crypto::argon2::generate($password), settings.marketing = $marketing, tags = $tags) SIGNIN (SELECT * FROM user WHERE username = $username AND crypto::argon2::compare(password, $password)) DURATION FOR TOKEN 15m, FOR SESSION 12h"
  },
  "analyzers": {},
  "configs": {},
  "functions": {
    "greet": "DEFINE FUNCTION fn::greet($name: string) RETURN \"Hello, \" + $name + \"!\";"
  },
  "models": {},
  "params": {},
  "tables": {
    "user": "DEFINE TABLE user SCHEMAFULL PERMISSIONS FOR select WHERE id = $auth.id OR $auth.admin = true, FOR create FULL, FOR update, delete WHERE id = $auth.id OR $auth.admin = true"
  },
  "users": {}
}

# check info for user
$ echo "INFO FOR TABLE user;" | surreal sql --json --hide-welcome --pretty --endpoint http://localhost:8001 --user root --pass root --ns test --db test
-- Query 1 (execution time: 316.537µs
{
  "events": {},
  "fields": {
    "password": "DEFINE FIELD password ON user TYPE string ASSERT $value != NONE PERMISSIONS FULL",
    "settings": "DEFINE FIELD settings ON user TYPE object DEFAULT {} PERMISSIONS FULL",
    "settings.marketing": "DEFINE FIELD settings.marketing ON user TYPE bool DEFAULT false PERMISSIONS FULL",
    "tags": "DEFINE FIELD tags ON user TYPE option<array<string>> DEFAULT [] PERMISSIONS FULL",
    "username": "DEFINE FIELD username ON user TYPE string ASSERT $value != NONE PERMISSIONS FULL"
  },
  "indexes": {
    "idx_username": "DEFINE INDEX idx_username ON user COLUMNS username UNIQUE"
  },
  "lives": {},
  "tables": {}
}
```

done, we have a ready to play surrealdb database ready to use with `signup` and `signin`

> more info on [gist](https://gist.github.com/koakh/fbbc37cde630bedcf57acfd4d6a6956b)

## Now launch Consumer Apps

from root `package.json`

### Always run Dev Watch for Lib

this way it will apply changes in lib, and propagate this changes to consumer apps

```shell
$ yarn app-lib:dev
```

### Launch REST Consumer App

> TIP: use a split window with `app-lib:dev` and `start:app-rst`, this way when file changes on both projects you will see watch reload working on both projects

```shell
# start dev (first runs kill-port, needs sudo; exposes node --inspect on 127.0.0.1:9232)
$ yarn start:app-rst
[Nest] 284274  - 10/15/2026, 11:02:44 AM     LOG [NestApplication] Nest application successfully started +2ms
[Nest] 284274  - 10/15/2026, 11:02:44 AM     LOG [NestApplication] Application is running on: http://[::1]:3030
[Nest] 284274  - 10/15/2026, 11:02:44 AM     LOG [NestApplication] using surrealDb host: ws://127.0.0.1:8001/rpc
```

> launch debug here, it will work with consumer app and lib/package

the consumer app resolves `@koakh/nestjs-surrealdb` as `workspace:^`, its nodemon also watches `../app-lib/src`, so lib edits reload the app. env defaults are built into `src/config/configuration.ts` (defaults to `ws://127.0.0.1:8001/rpc`, ns/db `test`, `root/root`, port `3030`) — no `.env` needed for the default local stack, override via `SURREALDB_URL/NAMESPACE/DATABASE/USERNAME/PASSWORD`, `HTTP_SERVER_PORT`

```shell
# or start the whole docker stack
$ yarn docker:app-rst:up
$ yarn docker:app-rst:down
```

### Launch GraphQL Consumer App / Tutorial App

moved to `packages-wip/` (not in the workspace, pending surrealdb.js v2 upgrade) — see `packages-wip/` for their legacy READMEs

## Test and Lint

- unit specs exist only in app-rst (scaffold-level, no DB needed):

```shell
$ cd packages/app-rst
$ yarn test
```

- e2e boots the full `AppModule` and **needs a running SurrealDB**:

```shell
$ cd packages/app-rst
$ yarn test:e2e
```

- lint/format (both packages use eslint + prettier, app-lib uses flat `eslint.config.mjs`):

```shell
$ yarn --cwd packages/app-lib lint
$ yarn --cwd packages/app-rst lint
```

## Publishing app-lib

```shell
# build + npm version patch
$ yarn app-lib:patch
# then bump the version in consumer apps and
$ yarn install --mode=skip-build

# publish — use npm, `yarn publish` fails with ENEEDAUTH
$ yarn app-lib:publish
```

> `workspace:^` deps can break `npm version` with EINVALIDPACKAGENAME — workaround in [NOTES.md](NOTES.md)

## Package Documentation

the complete package documentation (what it is, install, `forRoot`/`forRootAsync`, options, service API, opt-in REST controller, exported types, v0.1.x -> v0.2.0 migration) lives in the published package README:

- [`packages/app-lib/README.md`](packages/app-lib/README.md)

also ready-made REST requests against the running app-rst covering the full SDK v2 proxy surface:

- [`client.http`](client.http)

## More docs

- [`TLDR.md`](TLDR.md) — quick-start command sequence
- [`NOTES.md`](NOTES.md) — hard-won gotchas (DI/@Global, GraphQL generics, publish errors, SDK v2 migration lessons)
- [`packages/app-lib/CHANGELOG.md`](packages/app-lib/CHANGELOG.md) — release changelog
- [`AGENTS.md`](AGENTS.md) — repo instructions for AI coding agents
