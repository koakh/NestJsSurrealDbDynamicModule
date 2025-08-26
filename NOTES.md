# NOTES

- [NOTES](#notes)
  - [Problems](#problems)
    - [Graphql Error Handling](#graphql-error-handling)
  - [How to use Generic @InputType() in BaseResolver](#how-to-use-generic-inputtype-in-baseresolver)
    - [Solution for BaseResolver with DTO's (createEntity and updateEntity) with generics](#solution-for-baseresolver-with-dtos-createentity-and-updateentity-with-generics)
  - [Resolve N+1 Problem](#resolve-n1-problem)
    - [Fix Error #1: NestJS/GraphQL/DataLoader】Context creation failed: dataloader\_1.default is not a constructor](#fix-error-1-nestjsgraphqldataloadercontext-creation-failed-dataloader_1default-is-not-a-constructor)
    - [Fix #2: DataLoader with Arrays ex](#fix-2-dataloader-with-arrays-ex)
  - [npm ERR! need auth This command requires you to be logged in to https://registry.yarnpkg.com/](#npm-err-need-auth-this-command-requires-you-to-be-logged-in-to-httpsregistryyarnpkgcom)
  - [Force Consumer Apps to use AppLib package](#force-consumer-apps-to-use-applib-package)
  - [Fix: npm error code EINVALIDPACKAGENAME](#fix-npm-error-code-einvalidpackagename)
  - [https://claude.ai/chat/f0dbf42b-8120-4873-a75e-79ef339045e2: Claude help on use Generics with SurrealDb SDK, DTO Validations](#httpsclaudeaichatf0dbf42b-8120-4873-a75e-79ef339045e2-claude-help-on-use-generics-with-surrealdb-sdk-dto-validations)

some other projects and files that help

- `/home/mario/Development/@Koakh/node-modules/@koakh/@NestJsPackages/TypescriptNestJsPackageJwtAuthenticationLdap/nestjs-package-jwt-authentication-ldap-consumer/src/consumer-app/consumer-app.module.ts`

AFTER SO MANY HOURS the start solving is using `@Global` on `SurrealDbModule`

- `packages/app-lib/src/surrealdb/surrealdb.module.ts`

```ts
// required @Global() to override errors of 
// ERROR [ExceptionHandler] Nest can't resolve dependencies of the DbService (?). Please make sure that the argument SurrealDbService at index [0] is available in the DbModule context.
@Global()
@Module({
  providers: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders,
```

## Problems

### Graphql Error Handling

- [GraphQL doesn&#39;t work well with `BaseExceptionFilter` · Issue #5958 · nestjs/nest](https://github.com/nestjs/nest/issues/5958)
  - more helpful
- [Documentation | NestJS - A progressive Node.js framework](https://docs.nestjs.com/graphql/other-features)
- [Error handling](https://www.apollographql.com/docs/apollo-server/data/errors/)
- [https://towardsdev.com/nestjs-graphql-things-you-should-know-about-before-starting-a-project-7178690b90e0](https://towardsdev.com/nestjs-graphql-things-you-should-know-about-before-starting-a-project-7178690b90e0)

the trick to work with gql and http errors at same time is in files

- `packages/app-gql/src/app.module.ts`
  to return minimal error message

```ts
if (err.message) {
  return new Error(err.message);
}
```

- `packages/app-gql/src/common/filters/all-exceptions.filter.ts`

```ts
if ((ctx as any).contextType === 'graphql') {
  throw exception;
}    
```

## How to use Generic @InputType() in BaseResolver

Hi, I followed [GraphQL Class Inheritance](https://docs.nestjs.com/graphql/resolvers#class-inheritance) and implemented a `BaseResolver`,
and everything works well, I can extended it and have all the resolvers working, all `@Query`, `@Mutation` and `@Subscription` that don't need specfic `@InputType()` generics, like `create` and `update` in `@Mutation`'s, for ex

```ts
@InputType()
export class CreateRecipeInput extends BaseCreateEntityInput {
...
@InputType()
export class UpdateRecipeInput extends BaseUpdateEntityInput {
```

the problem is that I can't figure out the right way to pass the generic concrete type (`CreateRecipeInput`, `UpdateRecipeInput`) in `function BaseResolver`, 
I try hard and try everything I can't remember

my implementation with a non working `createEntity` because it uses specific `@InputType()` class

```ts
export function BaseResolver<T extends Type<BaseEntity>>(classRef: T): any {
  @Resolver({ isAbstract: true })
  abstract class BaseResolverHost {
    protected pubSub = new PubSub();

    constructor(private readonly serviceRef: BaseService<Type<BaseEntity>, BaseFindAllArgs, BaseCreateEntityInput, BaseUpdateEntityInput>) { }

    // BOF DON'T WORK because I Can't pass the specfic @InputType() in generic function BaseResolver
    @Mutation(() => [classRef], { name: `create${classRef.name}` })
    async createEntity(@Args(`create${classRef.name}Input`) createEntityInput: K) {
      const entity = await this.serviceRef.create(createEntityInput);
      pubSub.publish(`${classRef.name.toLowerCase()}Added`, { entityAdded: entity });
      return entity;
    }
    // EOF DON'T WORK because I Can't pass the specfic @InputType() in generic function BaseResolver

    @Query(() => classRef, { name: `findOne${classRef.name}` })
    async findOne(@Args('id') id: string) {
      return this.serviceRef.findOne(id);
    }

    @Query(() => [classRef], { name: `findMany${classRef.name}s` })
    async findMany(@Args() args: BaseFindAllArgs): Promise<any[]> {
      return this.serviceRef.findMany(args);
    }

    @Mutation(() => Boolean, { name: `remove${classRef.name}` })
    async removeEntity(@Args('id') id: string) {
      this.pubSub.publish(`${classRef.name.toLowerCase()}Deleted`, { [`${classRef.name.toLowerCase()}Deleted`]: id });
      return this.serviceRef.remove(id);
    }

    @Subscription(() => classRef, { name: `${classRef.name.toLowerCase()}Added` })
    entityAdded() {
      return this.pubSub.asyncIterator(`${classRef.name.toLowerCase()}Added`);
    }

    @Subscription(() => classRef, { name: `${classRef.name.toLowerCase()}Updated` })
    entityUpdated() {
      return this.pubSub.asyncIterator(`${classRef.name.toLowerCase()}Updated`);
    }

    @Subscription(() => String, { name: `${classRef.name.toLowerCase()}Deleted` })
    entityDeleted() {
      return this.pubSub.asyncIterator(`${classRef.name.toLowerCase()}Deleted`);
    }
  }
  return BaseResolverHost;
}
```

the question is how can I pass the generic concrete types 
`@InputType() CreateRecipeInput` and `@InputType() UpdateRecipeInput` into `function BaseResolver`?

what I really want to do is have a BaseResolver that implement the full "crud" for it's extended classes. the only that changes is the Dto `@InputType`, I think is awesome if we can do it, because this way we don't DRY same thing in every resolvers again and again

thanks

if I use for ex `K extends BaseCreateEntityInput` with `createEntityInput: K` it gives me the error
`Error: Undefined type error. Make sure you are providing an explicit type for the "create" (parameter at index [0]) of the "BaseResolverHost" class.`
on boot

```ts
export function BaseResolver<T extends Type<BaseEntity>, K extends BaseCreateEntityInput>(classRef: T): any {
  @Resolver({ isAbstract: true })
  abstract class BaseResolverHost {
    ...
    @Mutation(() => [classRef], { name: `create${classRef.name}` })
    async createEntity(@Args(`create${classRef.name}Input`) createEntityInput: K) {
```

with and without implicit generic `BaseResolver<Type<Restaurant>, CreateRecipeInput>` in `extends BaseResolver`

```ts
@Resolver(() => Restaurant)
export class RestaurantsResolver extends BaseResolver<Type<Restaurant>, CreateRestaurantInput>(Restaurant) {
```

if I change `createEntityInput: K` with `createEntityInput: CreateRestaurantInput` obvious it works, but useless

### Solution for BaseResolver with DTO's (createEntity and updateEntity) with generics

> Nice Post WITH THE SOLUTION [[Startup MVP recipes #6] GraphQL Resolver inheritance and a CRUD base resolver with generics - James Zhang](https://jczhang.com/2022/07/29/startup-mvp-recipes-6-graphql-resolver-inheritance-and-a-crud-base-resolver-with-generics/)

the trick is using `CreateClassRefInput: Type<K>` with PascalCase because its a Type, and next use the `, { type: () => CreateClassRefInput }) createClassRefInput: K` and `this.serviceRef.create(createClassRefInput)` and it starts to work as expected, awesome, pure magic

```ts
export function BaseResolver<T extends Type<BaseEntity>, K extends BaseCreateEntityInput>(classRef: T, CreateClassRefInput: Type<K>): any {
  @Resolver({ isAbstract: true })
  abstract class BaseResolverHost {
    protected pubSub = new PubSub();

    constructor(private readonly serviceRef: BaseService<Type<BaseEntity>, BaseFindAllArgs, BaseCreateEntityInput, BaseUpdateEntityInput>) { }

    @Mutation(() => [classRef], { name: `create${classRef.name}` })
    async createEntity(@Args(`create${classRef.name}Input`, { type: () => CreateClassRefInput }) createClassRefInput: K) {
      const entity = await this.serviceRef.create(createClassRefInput);
      this.pubSub.publish(`${classRef.name.toLowerCase()}Added`, { entityAdded: entity });
      return entity;
    }
```

and in subclass we use `BaseResolver<Type<Restaurant>, CreateRestaurantInput>(Restaurant, CreateRestaurantInput)`, or let TS infer its generic type with `BaseResolver(Restaurant, CreateRestaurantInput)`

```ts
@Resolver(() => Restaurant)
export class RestaurantsResolver extends BaseResolver(Restaurant, CreateRestaurantInput) {
  // we omit implicit <Type<Restaurant>, CreateRestaurantInput>, and let TS infer it :)
  constructor(private readonly restaurantsService: RestaurantsService, private readonly recipesService: RecipesService) {
    super(restaurantsService);
  }
```

## Resolve N+1 Problem

- [How to use GraphQL Dataloaders in NestJS](https://eoin.ai/how-to-use-graphql-dataloaders-in-nestjs)
- [GitHub - tracworx/nestjs-dataloader: Quick and easy GraphQL dataloaders for NestJS](https://github.com/tracworx/nestjs-dataloader)
- [How to use DataLoader with NestJS - LogRocket Blog](https://blog.logrocket.com/use-dataloader-nestjs/)

create a restaurant and 5 recipes, all with same restaurant, create 1+5 request, 1 for recipes, and the other 5 to resolve the same restaurant

```
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM type::table($table) LIMIT 10 START 0
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM $what
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM $what
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM $what
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM $what
[2022-09-26 22:36:56] DEBUG surrealdb::dbs Executing: SELECT * FROM $what
```

```shell
$ cd packages/app-gql
# require force to work with nestjs 9
$ npm install @tracworx/nestjs-dataloader --force
```

### Fix Error #1: NestJS/GraphQL/DataLoader】Context creation failed: dataloader_1.default is not a constructor

```ts
import * as DataLoader from 'dataloader';
// instead of
import DataLoader from 'dataloader';
```

### Fix #2: DataLoader with Arrays ex

- [How do I return an array from a dataloader?](https://stackoverflow.com/questions/56331154/how-do-i-return-an-array-from-a-dataloader)

**Your batch load function should return a Promise with an array**. 
As the error indicates, the **length of the keys passed to the batch load function must match the length of this result array**. If your Loader is **fetching an array of items for each key**, then the **Promise must resolve to an array of arrays**.

```js
const backLoadFn = (keys) => {
  return Promise.all(keys.map(key => {
    return Model.findAll({ where: { key } })
  }))
}
```

```gql
query findManyRestaurants($skip: Int, $take: Int) {
  findManyRestaurants(skip: $skip, take: $take) {
    id
    # this is a array
    recipes {
      id
      title
    }
  }
}
```

## npm ERR! need auth This command requires you to be logged in to https://registry.yarnpkg.com/

```shell
$ yarn start:app-lib:publish
...
npm ERR! code ENEEDAUTH
npm ERR! need auth This command requires you to be logged in to https://registry.yarnpkg.com/
npm ERR! need auth You need to authorize this machine using `npm adduser`

npm ERR! A complete log of this run can be found in:
npm ERR!     /home/mario/.npm/_logs/2022-10-11T21_10_15_256Z-debug-0.log
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
error Command failed with exit code 1.
info Visit https://yarnpkg.com/en/docs/cli/run for documentation about this command.
```

to fix just use `npm publish`

```shell
$ cd packages/app-lib
$ npm publish
# outcome
npm notice Publishing to https://registry.npmjs.org/
+ @koakh/nestjs-surrealdb@0.1.5
```

## Force Consumer Apps to use AppLib package

in case of consumer apps don't have the last updates from app-lib use

```shell
$ rm packages/app-lib/dist/ -R 
$ rm packages/app-rst/node_modules/@koakh -R
$ rm packages/app-gql/node_modules/@koakh -R

$ yarn app-lib:dev
$ yarn install --mode=skip-build
$ yarn start:app-rst
$ yarn start:app-gql
```

## Fix: npm error code EINVALIDPACKAGENAME

```shell
$ npm run version:patch
v0.1.18
npm error code EINVALIDPACKAGENAME
npm error Invalid package name "// in case of error: npm error Unsupported URL Type "workspace:": workspace:^, comment bellow line and use npm version patch" of package "// in case of error: npm error Unsupported URL Type "workspace:": workspace:^, comment bellow line and use npm version patch@": name can only contain URL-friendly characters.
```

- `packages/app-rst/package.json`

```json
"dependencies": {
    "// in case of error: npm error Unsupported URL Type \"workspace:\": workspace:^, remove this line and bellow line and use npm version:patch": "",
    // "@koakh/nestjs-surrealdb": "workspace:^",
}
```

fix removing both lines,

after this both commands works flawless `version:patch` and `version:publish`

## https://claude.ai/chat/f0dbf42b-8120-4873-a75e-79ef339045e2: Claude help on use Generics with SurrealDb SDK, DTO Validations

- [SurrealDB NestJS Type Safety](https://claude.ai/chat/f0dbf42b-8120-4873-a75e-79ef339045e2)
