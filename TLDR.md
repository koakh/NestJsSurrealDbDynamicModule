# TLDR

quick-start command sequence — see [README.md](README.md) for the details

```shell
$ git clone https://github.com/koakh/NestJsSurrealDbDynamicModule.git
# node >= 22 required (SDK v2 uses the global WebSocket)
$ yarn install --mode=skip-build

# term1: surrealdb v4 (compose maps it to host port 8001, persistent volume)
$ yarn surreal:docker
# install the v4 surreal CLI (one time, into ~/.local/bin)
$ yarn surreal:install
# term2: init database (always wipes and re-imports; required for the signup/signin demo endpoints)
$ yarn surreal:initdb

# term2: build + watch the lib
$ yarn app-lib:dev

# term3: start the consumer app (defaults to ws://127.0.0.1:8001/rpc)
$ yarn start:app-rst
```

```shell
# lib surface test against a live server (PASS/FAIL matrix, 28 checks)
$ yarn app-lib:surface

# or the whole docker stack (app + db, from the repo root context)
$ yarn docker:app-rst:up
```

```shell
# publish
$ cd packages/app-lib
$ corepack yarn yalc:publish   # test the artifact in a real consumer first (ex c3-backend)
$ npm publish                  # `yarn publish` fails with ENEEDAUTH
```
