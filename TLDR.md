# TLDR

## Checkout Project

```shell
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

# term2: init database (required for useres postSignUp and postSignIn)
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
$ cd packages/app-rst && yarn install --mode=skip-build
$ npm run version:publish
```
