# TLDR

quick-start command sequence — see [README.md](README.md) for the details

```shell
$ git clone https://github.com/koakh/NestJsSurrealDbDynamicModule.git
# node >= 22 required (SDK v2 uses the global WebSocket)
$ yarn install --mode=skip-build

# term1: surrealdb v4 (compose maps it to host port 8001)
$ yarn surreal:docker
# install the v4 surreal CLI (one time, into ~/.local/bin)
$ yarn surreal:install
# term2: init database (required for postSignUp and postSignIn)
$ yarn surreal:initdb

# term2: build + watch the lib
$ yarn app-lib:dev

# term3: start the consumer app (defaults to ws://127.0.0.1:8001/rpc)
$ yarn start:app-rst
```

```shell
# publish
$ cd packages/app-lib
$ npm publish
```
