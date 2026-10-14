# README

surrealdb nestjs 9 dynamic module wrapper on top of [surrealdb.js](https://surrealdb.com/surrealdb.js) driver, with DataLoaders, Subscriptions and BaseClasses to generate CRUD from simple DTOs and using Schemaless SurrealDb Scheme.....

## Create a new NestJs Application

Setting up a new project is quite simple with the **Nest CLI**. With npm installed, you can create a new Nest project with the following commands in your OS terminal:

```shell
$ nest new surrealdb-graphql
? Which package manager would you ❤️  to use? 
  npm 
❯ yarn 
  pnpm
```

## Installing the required packages and create a simple graphql app

```shell
$ cd tutorial-graphql
$ yarn add @nestjs/graphql @nestjs/apollo @nestjs/config @apollo/server apollo-server-express graphql graphql-subscriptions graphql-query-complexity class-transformer @graphql-tools/utils @koakh/nestjs-surrealdb @koakh/nestjs-dataloader
```

## CleanUp non used Files

```shell
# remove unused files
$ rm src/app.controller.spec.ts src/app.controller.ts src/app.service.ts
```

## Add .env File

`.env`

```bash
GRAPHQL_SERVER_PORT="3030"
GRAPHQL_AUTO_SCHEMA_FILE='./schema.gql'
SURREALDB_URL="ws://127.0.0.1:8001/rpc"
SURREALDB_NAMESPACE="test"
SURREALDB_DATABASE="test"
SURREALDB_USERNAME="root"
SURREALDB_PASSWORD="root"
```

## Change AppModule

configure `ConfigModule`, `SurrealDbModule` and `GraphQLModule`

replace `src/app.module.ts` with

```ts
import { SurrealDbModule } from '@koakh/nestjs-surrealdb';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SurrealDbModule.forRootAsync(SurrealDbModule, {
      useFactory: async (configService: ConfigService) => ({
        url: configService.get('SURREALDB_URL'),
        namespace: configService.get('SURREALDB_NAMESPACE'),
        database: configService.get('SURREALDB_DATABASE'),
        username: configService.get('SURREALDB_USERNAME'),
        password: configService.get('SURREALDB_PASSWORD'),
      }),
      imports: [AppModule],
      inject: [ConfigService],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(
          process.cwd(),
          configService.get<string>('GRAPHQL_AUTO_SCHEMA_FILE'),
        ),
        installSubscriptionHandlers: true,
        formatError: (err) => {
          if (err.extensions.code === 'INTERNAL_SERVER_ERROR') {
            return new Error(err.message);
          }
          return err;
        },
      }),
    }),
  ],
})
export class AppModule {}
```

now we can use `surrealDb: SurrealDbService` like any other NestJs provider ex

```ts
@Injectable()
export class RecipesService extends BaseService<Type<Recipe>, BaseFindAllArgs, CreateRecipeInput, UpdateRecipeInput> {
  constructor(protected readonly surrealDb: SurrealDbService) {
    super(surrealDb);
    this.entityName = Recipe;
  }
}
```

view the [full example](https://github.com/koakh/NestJsSurrealDbDynamicModule/tree/main/packages/app-gql) or [tutorial](https://github.com/koakh/NestJsSurrealDbDynamicModule/tree/main/packages/tutorial-graphql)
