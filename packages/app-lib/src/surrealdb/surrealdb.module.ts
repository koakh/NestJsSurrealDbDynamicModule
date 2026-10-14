import { ConfigurableModuleBuilder, Global, Module } from '@nestjs/common';
import { SURREALDB_MODULE_OPTIONS } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';
import { createNestSurrealDbModuleProviders } from './surrealdb.providers';
import { SurrealDbService } from './surrealdb.service';

// official `@nestjs/common` replacement for `@golevelup/nestjs-modules` `createConfigurableDynamicRootModule`
// generates `SurrealDbModule.forRoot()` and `SurrealDbModule.forRootAsync()`
// `optionsInjectionToken` pins the injection token to `SURREALDB_MODULE_OPTIONS`
// (auto-generation from a `moduleName` would produce `SURREAL_DB_MODULE_OPTIONS`)
const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<SurrealDbModuleOptions>({
  optionsInjectionToken: SURREALDB_MODULE_OPTIONS,
})
  .setClassMethodName('forRoot')
  .build();

// re-export the exact generated token
export { MODULE_OPTIONS_TOKEN };

// required @Global() to override errors of
// ERROR [ExceptionHandler] Nest can't resolve dependencies of the DbService (?). Please make sure that the argument SurrealDbService at index [0] is available in the DbModule context.
@Global()
@Module({
  providers: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders,
  ],
  exports: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders,
  ],
  controllers: [
    // uncomment to expose SurrealDbController to consumer apps
    // SurrealDbController,
    // to use this preconfigured controller in consumer apps just use it in `AppModule` `controllers: [SurrealDbController]`
    // and that should be the way to go, package only exports and consumer use it or not
  ],
})
export class SurrealDbModule extends ConfigurableModuleClass { }
