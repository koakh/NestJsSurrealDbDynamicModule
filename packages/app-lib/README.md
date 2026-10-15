# @koakh/nestjs-surrealdb

[NestJs](https://nestjs.com/) `@Global()` dynamic module wrapper on top of [surrealdb.js](https://surrealdb.com/docs/integration/libraries/nodejs) **v2** ([github](https://github.com/surrealdb/surrealdb.js)), with a `SurrealDbService` that proxies the **full SDK v2 surface** and an **opt-in REST controller** exposing it over HTTP.

> this is **just a simple wrapper on top** of the official driver, check the [github repo](https://github.com/surrealdb/surrealdb.js), and don't forget to give a **star** to the project and integrations, this "surreal dream team" deserve it

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [`forRoot`](#forroot)
  - [`forRootAsync` (recommended)](#forrootasync-recommended)
- [Configuration Options](#configuration-options)
- [The `userService` / `APP_SERVICE` wiring](#the-userservice--app_service-wiring)
- [Using `SurrealDbService`](#using-surrealdbservice)
  - [CRUD (data methods)](#crud-data-methods)
  - [Query, GQL and `run`](#query-gql-and-run)
  - [Transactions](#transactions)
  - [Live Queries](#live-queries)
  - [Authentication](#authentication)
  - [Import / Export](#import--export)
  - [Sessions and Connection](#sessions-and-connection)
- [Opt-in REST Controller](#opt-in-rest-controller)
- [Exported Types and Helpers](#exported-types-and-helpers)
- [Migration v0.1.x -> v0.2.0](#migration-v01x---v020)
- [Demo Application](#demo-application)
- [Development](#development)
- [License](#license)

## Features

- `SurrealDbModule.forRoot()` / `SurrealDbModule.forRootAsync()` built with `ConfigurableModuleBuilder` (`@nestjs/common`)
- `SurrealDbService` proxying the full surrealdb.js v2 API: connection, sessions, transactions, import/export, auth, live queries, SurrealDB 3 ISO GraphQL, user-defined APIs
- string-friendly API: pass `"table"` or `"table:id"` strings, the service converts to SDK v2 `Table` / `StringRecordId` value classes
- `select` query-builder options (`where`, `limit`, `start`, `fields`, `fetch`)
- `update` / `upsert` with `mode: 'content' | 'merge' | 'patch'`
- `query` with pluggable result modes: `collect` (default), `json`, `responses` (with stats), `stream`
- automatic reconnect (unlimited attempts, exponential backoff) and connection lifecycle events
- opt-in `SurrealDbController`: the whole SDK surface as REST endpoints
- re-exports the most useful SDK v2 value classes and types, so consumers don't need to depend on `surrealdb` directly

## Requirements

- **Node >= 22** (SDK v2 uses the global `WebSocket`)
- `@nestjs/common` **^11** (peer dependency) and `reflect-metadata` ^0.2
- SurrealDB server **v2+** (verified against [v3.1.6](https://surrealdb.com/blog/surrealdb-3-0))

## Installation

```shell
$ npm install @koakh/nestjs-surrealdb
# or
$ yarn add @koakh/nestjs-surrealdb
```

## Quick Start

### `forRoot`

```ts
import { SurrealDbModule } from '@koakh/nestjs-surrealdb';

@Module({
  imports: [
    SurrealDbModule.forRoot({
      url: 'ws://127.0.0.1:8001/rpc',
      namespace: 'test',
      database: 'test',
      username: 'root',
      password: 'root',
    }),
  ],
})
export class AppModule {}
```

### `forRootAsync` (recommended)

> since v0.2.0 the module is built with `ConfigurableModuleBuilder`, **no class-ref first argument**: `SurrealDbModule.forRootAsync({...})` (v0.1.x was `SurrealDbModule.forRootAsync(SurrealDbModule, {...})`)

```ts
import { SurrealDbModule } from '@koakh/nestjs-surrealdb';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SurrealDbModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        url: configService.get('SURREALDB_URL'),
        namespace: configService.get('SURREALDB_NAMESPACE'),
        database: configService.get('SURREALDB_DATABASE'),
        username: configService.get('SURREALDB_USERNAME'),
        password: configService.get('SURREALDB_PASSWORD'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

the service connects (and signs in) in the constructor, ready to inject anywhere (the module is `@Global()`, no need to re-import it in feature modules)

```ts
import { SurrealDbService } from '@koakh/nestjs-surrealdb';

@Injectable()
export class AppService {
  constructor(private readonly surrealDb: SurrealDbService) {}

  findAll(): Promise<Person[]> {
    return this.surrealDb.select<Person>('person');
  }
}
```

## Configuration Options

| option | type | default | description |
| --- | --- | --- | --- |
| `url` | `string` | - | SurrealDB endpoint, ex `ws://127.0.0.1:8001/rpc`, `http://...`, `mem://` |
| `namespace` | `string` | - | namespace to use |
| `database` | `string` | - | database to use |
| `username` | `string` | - | system user (root/ns/db) credentials |
| `password` | `string` | - | system user password |
| `userService` | `UserServiceAbstract` | - | consumer app user service, see [the wiring](#the-userservice--app_service-wiring) |
| `initSurrealDb` | `boolean` | `true` | set `false` to skip the automatic connect on boot (ex when surrealdb is disabled in the consumer) |
| `initSurrealDbThrowError` | `boolean` | `true` | set `false` to log-and-continue when the connection fails at boot, instead of crashing the app |
| `reconnect` | `ConnectOptions['reconnect']` | `{ enabled: true, attempts: -1, retryDelay: 1000, retryDelayMax: 30000, retryDelayMultiplier: 2 }` | auto-reconnect configuration (unlimited attempts, exponential backoff; namespace/database/authentication are restored automatically) |
| `retry` | `ConnectOptions['retry']` | - | SDK v2 `ConnectOptions` passthrough |
| `renewAccess` | `boolean` | - | SDK v2 `ConnectOptions` passthrough |
| `versionCheck` | `boolean` | - | SDK v2 `ConnectOptions` passthrough |

## The `userService` / `APP_SERVICE` wiring

the service injects a consumer-provided `UserServiceAbstract` (used by `surrealDbService.getUserFindOneByField()`), which requires a small wiring on the consumer side:

1. implement the abstract class in your app

```ts
import { UserServiceAbstract } from '@koakh/nestjs-surrealdb';

@Injectable()
export class UserService extends UserServiceAbstract {
  async findOneByField(key: string, value: string): Promise<User> {
    // your query here
  }
}
```

2. provide it to the dynamic module factory and export it under the `APP_SERVICE` token from your `AppModule` (this is what makes it resolvable inside `SurrealDbModule`)

```ts
import { APP_SERVICE, SurrealDbModule } from '@koakh/nestjs-surrealdb';

@Module({
  imports: [
    SurrealDbModule.forRootAsync({
      useFactory: async (configService: ConfigService, userService: UserService) => ({
        url: configService.get('SURREALDB_URL'),
        /* ... */
        userService,
      }),
      // required, else: Nest can't resolve dependencies of the SurrealDbService (..., ?)
      imports: [AppModule, UserModule],
      inject: [ConfigService, UserService],
    }),
  ],
  providers: [{ provide: APP_SERVICE, useClass: AppService }],
  exports: [{ provide: APP_SERVICE, useClass: AppService }],
})
export class AppModule {}
```

view the complete working example in the consumer demo app [`packages/app-rst/src/app.module.ts`](https://github.com/koakh/NestJsSurrealDbDynamicModule/blob/main/packages/app-rst/src/app.module.ts)

## Using `SurrealDbService`

### CRUD (data methods)

`thing` is always a plain string: `"table"` or `"table:id"` (converted internally to SDK v2 `Table` / `StringRecordId`)

```ts
// select all records of a table
const people = await surrealDb.select<Person>('person');

// select one record (throws `Record not found` if missing)
const mario = await surrealDb.select<Person>('person:mario');

// select with builder options
const results = await surrealDb.select<Person>('person', {
  where: 'age > 18',
  limit: 10,
  start: 20,          // offset
  fields: ['id', 'name'],
  fetch: ['friends'], // resolve graph edges
});

// create (random or specified id)
await surrealDb.create('person', { name: 'mario' });
await surrealDb.create('person:mario', { name: 'mario' });

// insert one or many records
await surrealDb.insert('person', [{ name: 'a' }, { name: 'b' }]);

// update: CAREFUL, default `content` mode REPLACES the record data
await surrealDb.update('person:mario', { name: 'mario v2' });              // replace
await surrealDb.update('person:mario', { age: 40 }, 'merge');              // merge
await surrealDb.update('person:mario', [{ op: 'replace', path: '/age', value: 41 }], 'patch'); // JSON Patch

// upsert: create-or-update (same modes)
await surrealDb.upsert('person:mario', { name: 'mario' }, 'merge');

// delete all records of a table, or one record
await surrealDb.delete('person');
await surrealDb.delete('person:mario');

// graph edges, single or fan-out
await surrealDb.relate('person:mario', 'follows', 'person:ana', { since: '2026-01-01' });
await surrealDb.relate(['person:a', 'person:b'], 'follows', 'person:ana');
```

### Query, GQL and `run`

```ts
// SurrealQL with bindings
const res = await surrealDb.query<Person[]>(
  'SELECT * FROM person WHERE age > $minAge',
  { minAge: 18 },
);

// result modes: 'collect' (default) | 'json' | 'responses' (with stats) | 'stream'
const stats = await surrealDb.query('SELECT * FROM person', undefined, 'responses');

// ISO GraphQL (SurrealDB 3.x only)
const gqlRes = await surrealDb.gql<{ person: Person[] }>(
  'query { person { id name } }',
);

// run a SurrealQL function
const now = await surrealDb.run<string>('time::now');
```

### Transactions

```ts
const tx = await surrealDb.beginTransaction();
await tx.query('CREATE person:mario SET name = $name', { name: 'mario' });
await tx.commit();   // or tx.cancel() to discard
```

### Live Queries

```ts
// start a live query on a table (or record)
const subscription = await surrealDb.live('person');

// subscribe to actions: 'CREATE' | 'UPDATE' | 'DELETE'
subscription.subscribe((action, result) => console.log(action, result));

// or async iterate
for await (const message of subscription) { /* ... */ }

// kill it (or any live query by its uuid)
await subscription.kill();

// subscribe to an existing live query started elsewhere
const sub2 = await surrealDb.liveOf(subscription.id);
```

### Authentication

```ts
// record access signup (requires a DEFINE ACCESS ... TYPE RECORD, see the demo initdb)
const tokens = await surrealDb.signup({
  namespace: 'test',
  database: 'test',
  access: 'account',
  variables: { username: 'alex', password: 'password', marketing: true, tags: ['rust', 'golang', 'javascript'] },
});

// record or system user signin -> Tokens { access, refresh? }
const tokens2 = await surrealDb.signin({ username: 'root', password: 'root' });

// authenticate the session with a token or tokens pair
await surrealDb.authenticate(tokens.access);

// currently authenticated record user (v2 replacement for v1 `info`)
const user = await surrealDb.auth<User>();

// invalidate the current session authentication
await surrealDb.invalidate();
```

### Import / Export

```ts
// SurrealQL import, v3 requires `OPTION IMPORT;` as first statement,
// it is prepended automatically when not present
await surrealDb.import('DEFINE TABLE person SCHEMALESS;');

// export the whole database as SurrealQL
const surql = await surrealDb.export();

// export a SurrealML model
await surrealDb.exportModel('my-model', '1.0.0');
```

### Sessions and Connection

```ts
// v2 replacement for v1 `ping`
await surrealDb.health();

// { version: "surrealdb-3.1.6" }
const { version } = await surrealDb.version();

// status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'
surrealDb.getStatus();
surrealDb.getIsConnected();

// SurrealDB 3 feature flags, ex Features.LiveQueries
surrealDb.isFeatureSupported(Features.LiveQueries);

// connection lifecycle events (also logged at debug level by the module)
const unsubscribe = surrealDb.subscribe('connected', (version) => { /* ... */ });
unsubscribe();

// isolated sessions (own ns/db/vars/auth state)
const session = await surrealDb.newSession();
const fork = await surrealDb.forkSession();
await surrealDb.sessions();    // list session uuids

// switch namespace/database, session variables (v2 `set`/`unset` replace v1 `let`)
await surrealDb.use('test', 'test');
await surrealDb.set('minAge', 18);
await surrealDb.unset('minAge');

// SurrealDB 3 user-defined API endpoints
const api = surrealDb.api('/api') as any;
await api.get('/users');

await surrealDb.close();
```

## Opt-in REST Controller

the lib ships `SurrealDbController`, exposing the whole service surface under `surrealdb/`. it is opt-in: add it to your own `controllers` array (the package only exports it, the consumer decides)

```ts
import { SurrealDbController } from '@koakh/nestjs-surrealdb';

@Module({
  controllers: [AppController, SurrealDbController],
})
export class AppModule {}
```

| group | endpoints |
| --- | --- |
| connection | `POST /surrealdb/connect` `{url}`, `POST /surrealdb/close`, `GET /surrealdb/health`, `GET /surrealdb/status`, `GET /surrealdb/is-connected`, `GET /surrealdb/is-feature-supported/:feature`, `GET /surrealdb/version`, `POST /surrealdb/subscribe/:event` |
| sessions | `GET /surrealdb/sessions`, `POST /surrealdb/session`, `POST /surrealdb/session/fork`, `DELETE /surrealdb/session`, `POST /surrealdb/reset`, `POST /surrealdb/use` `{namespace, database}` |
| import/export | `POST /surrealdb/import` `{data}`, `POST /surrealdb/export`, `GET /surrealdb/export-model/:name/:version` |
| transactions | `POST /surrealdb/transaction` -> `{id}`, `POST /surrealdb/transaction/:id/query` `{query, bindings}`, `POST /surrealdb/transaction/:id/commit`, `POST /surrealdb/transaction/:id/cancel` |
| auth | `POST /surrealdb/signup`, `POST /surrealdb/signin`, `POST /surrealdb/authenticate` `{token, refresh?}`, `POST /surrealdb/invalidate`, `GET /surrealdb/auth` |
| query | `POST /surrealdb/query` `{query, bindings, mode}`, `POST /surrealdb/gql` `{query, variables}` (SurrealDB 3), `POST /surrealdb/run/:name` `[args]` |
| user-defined APIs | `ANY /surrealdb/api/*` (proxied to SurrealDB 3 `db.api()`) |
| live queries | `POST /surrealdb/live/:thing` -> `{id}`, `POST /surrealdb/live-of/:id`, `DELETE /surrealdb/live/:id` |
| data | `GET /surrealdb/select/:thing?where=&limit=&start=&fields=&fetch=`, `POST /surrealdb/create/:thing` `{data}`, `POST /surrealdb/insert/:thing` `{data}`, `PUT /surrealdb/update/:thing` `{data, mode}`, `PATCH /surrealdb/upsert/:thing` `{data, mode}`, `DELETE /surrealdb/delete/:thing`, `POST /surrealdb/relate/:thing` `{from|fromMany, to|toMany, data}` |
| session vars | `POST /surrealdb/set` `{variable, value}`, `POST /surrealdb/unset` `{variable}` |

> the demo repo ships a ready-made [`client.http`](https://github.com/koakh/NestJsSurrealDbDynamicModule/blob/main/client.http) with requests covering the full surface

## Exported Types and Helpers

re-exported from surrealdb.js v2, so consumers don't need to depend on `surrealdb` directly

```ts
import {
  // value classes
  RecordId, RecordIdRange, StringRecordId, Table, Uuid,
  // tagged template for safe SurrealQL fragments
  surql,
  // SurrealDB 3 feature flags
  Features,
  // types
  AccessRecordAuth, AnyAuth, ConnectionStatus, LiveResource,
  NamespaceDatabase, SqlExportOptions, Tokens, VersionInfo,
  // module
  SurrealDbModule, SurrealDbService, SurrealDbController, SurrealDbModuleOptions,
  MODULE_OPTIONS_TOKEN, APP_SERVICE,
  UserServiceAbstract, AppServiceAbstract,
} from '@koakh/nestjs-surrealdb';
```

also exported: the REST DTOs (`QueryDto`, `DataDto`, `UpdateDto`, `RelateDto`, `SignupDto`, `SigninDto`, `AuthenticateDto`, `ConnectDto`, `UseDto`, `SetDto`, `GqlDto`), legacy metadata decorators (`ModelProps`, `Properties`, `Persisted`) and string helpers on the service (`isRecordId`, `parseThing`, `thingExists`, `recordIdFromStringThing`).

## Migration v0.1.x -> v0.2.0

v0.2.0 is a **breaking release**: surrealdb.js `1.1.0` -> `2.1.1` (SurrealDB server `v2.0.0+`, verified against `v3.1.6`), `@golevelup/nestjs-modules` replaced by `@nestjs/common` `ConfigurableModuleBuilder`, Node **>= 22** required.

| v0.1.x | v0.2.0 |
| --- | --- |
| `SurrealDbModule.forRootAsync(SurrealDbModule, {...})` | `SurrealDbModule.forRootAsync({...})` (no class-ref) |
| `ping()` | `health()` |
| `info()` | `auth()` |
| `let()` | `set()` |
| `merge()` / `patch()` | `update()` / `upsert()` with `mode: 'merge' \| 'patch'` |
| bare token string from `signin`/`signup` | `Tokens { access, refresh? }` |
| `version(): string` | `version(): VersionInfo { version }` |
| REST `/ping`, `/info`, `/let`, `/query-raw`, `/merge`, `/patch`, `/insert-relation`, `/rpc`, `/subscribe-live`, `/unsubscribe-live`, `/kill/:uuid` | removed, replaced by the SDK v2 surface (see the [controller table](#opt-in-rest-controller)) |

full changelog at [CHANGELOG.md](https://github.com/koakh/NestJsSurrealDbDynamicModule/blob/main/packages/app-lib/CHANGELOG.md)

## Demo Application

[`@koakh/nestjs-surrealdb-rest-demo`](https://github.com/koakh/NestJsSurrealDbDynamicModule/tree/main/packages/app-rst) (in the same monorepo, `packages/app-rst`) is a NestJS 11 REST consumer app that wires the module end-to-end (ConfigService + UserService, `SurrealDbController` enabled) and covers the full SDK v2 proxy surface over REST.

## Development

the package lives in a yarn 4 workspaces monorepo, see the [root README](https://github.com/koakh/NestJsSurrealDbDynamicModule#readme) for the full dev environment (SurrealDB v3 docker stack, `--mode=skip-build` install rule, watch/dev loop and publish steps)

```shell
$ cd packages/app-lib
$ yarn install --mode=skip-build
$ yarn dev     # tsc watch
$ yarn build   # tsc
$ yarn lint    # eslint (flat config)
$ yarn format  # prettier
```

## License

UNLICENSED, see the [repository](https://github.com/koakh/NestJsSurrealDbDynamicModule)
