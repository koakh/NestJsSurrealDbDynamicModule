# Contributing

1. [Fork it](https://help.github.com/articles/fork-a-repo/)
2. Clone and install dependencies (see below)
3. Create your feature branch (`git checkout -b my-new-feature`)
4. Commit your changes (`git commit -am 'Added some feature'`)
5. Verify your changes (see [Testing](#testing))
6. Push to the branch (`git push origin my-new-feature`)
7. [Create new Pull Request](https://help.github.com/articles/creating-a-pull-request/)

## Setup

this package lives in a yarn 4 workspaces monorepo (node `>= 22`, corepack). **always** install with `--mode=skip-build`, a plain install can loop forever building dependencies (the lib has a `prepare` build script):

```shell
$ git clone https://github.com/koakh/NestJsSurrealDbDynamicModule.git
$ cd NestJsSurrealDbDynamicModule
$ corepack enable
$ yarn install --mode=skip-build
```

## Testing

the lib itself has **no test setup** (scripts and deps removed in v0.2.0). verify changes with the consumer demo app, which exercises the lib end-to-end:

```shell
# terminal 1: tsc watch for the lib
$ yarn app-lib:dev

# terminal 2: demo app on port 3030 (nodemon also watches ../app-lib/src)
$ yarn start:app-rst

# unit specs live in the demo app
$ cd packages/app-rst && yarn test
```

e2e (`yarn test:e2e` in app-rst) boots the full AppModule and needs a running SurrealDB v3 — see the [root README](../../README.md).

## Code Style

We use [Prettier](https://prettier.io/) and [eslint](https://eslint.org/) (flat `eslint.config.mjs`, migrated from deprecated tslint in v0.2.0). Please make sure your PR adheres to the guides by running:

```shell
$ yarn --cwd packages/app-lib format
$ yarn --cwd packages/app-lib lint
```

## Build

```shell
$ yarn --cwd packages/app-lib build
```

> gotcha: after deleting `packages/app-lib/dist` also delete `packages/app-lib/tsconfig.tsbuildinfo` — `incremental: true` makes tsc silently skip emit when the state file survives, so `yarn build` "succeeds" with no output
