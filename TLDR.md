# TLDR

## Required Node > v16.15.0 else

2026-01-13 12:23:04

```shell
$ node -v
v16.15.0

[Nest] 69041  - 01/13/2026, 11:45:21 AM   ERROR [SurrealDbService] Failed to connect to SurrealDB at url: http://127.0.0.1:8888/rpc, namespace: micropal, database: micropal
ReferenceError: fetch is not defined
```


## Checkout Project

```shell
# required node 22.14
$ nvh i 22.14
$ git clone https://github.com/koakh/NestJsSurrealDbDynamicModule.git
$ yarn install --mode=skip-build
# term1 : optional, only if don't connect to c3-system-stack, see `packages/app-rst/.env`
# yarn surreal
# term2: install local package to start develop
$ cd packages/app-rst
# must re-add to prevent missing local package
$ yarn add @koakh/nestjs-surrealdb --mode=skip-build

# back
cd ../..

## Run Development environment

# term1
$ yarn surreal:docker

# term2: init database (required for users postSignUp and postSignIn)
$ yarn surreal:initdb

# term3: launch lib dev
$ cd packages/app-lib/
$ yarn app-lib:dev

# term4: launch consumer app or launch debugger configuration `Launch via Yarn`
$ cd packages/app-rst/
$ yarn start:app-rst
```

## Launch some test Requests

1. `postSignUp`
2. `postSignIn`
3. `postCreate`
4. `postInsert`
5. `getSelect`

and feel free to test other endpoints to

## Build and Publish Package

### Yalc Build and Publish Package

```shell
# in project root
$ yarn app-lib:build
$ yarn yalc:publish
```

### Build and Publish Package on NPM

```shell
$ cd packages/app-lib
# comment `"@koakh/nestjs-surrealdb": "workspace:^"` on `packages/app-rst/package.json` first
$ npm run version:patch --legacy-peer-deps
# uncomment `"@koakh/nestjs-surrealdb": "workspace:^"` on `packages/app-rst/package.json` first
$ npm run version:publish
```

## Run On c3-backend

best way to work with backend is just a combination of `yarn yalc:publish` and `npm run start:debug:yalc`

```shell
# term1: launch lib dev
$ cd packages/app-lib/
$ yarn app-lib:dev

# add a breakpoint here
# if (!config.initSurrealDb || !config.initSurrealDb === false) {
```

launch debugger with F5, this will consumer rest app

to use it in c3-backend

```shell
# in project root
$ yarn app-lib:build
$ yarn yalc:publish
```

now launch backend  with

```shell
# term2: launch c3-backend
$ start:debug:yalc
```

this will assume changes in code