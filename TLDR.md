# TLDR

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

# development environment

# term2
$ yarn app-lib:dev
# term3
$ yarn start:app-rst
```
