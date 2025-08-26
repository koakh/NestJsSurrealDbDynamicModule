import { createConfigurableDynamicRootModule } from '@golevelup/nestjs-modules';
import { Global, Module } from '@nestjs/common';
import { SURREALDB_MODULE_OPTIONS } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';
import { createNestSurrealDbModuleProviders } from './surrealdb.providers';
import { SurrealDbService } from './surrealdb.service';

// required @Global() to override errors:
// ERROR [ExceptionHandler] Nest can't resolve dependencies of the DbService (?). Please make sure that the argument SurrealDbService at index [0] is available in the DbModule context.
@Global()
@Module({
  providers: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders,
  ],
  exports: [
    SurrealDbService,
    ...createNestSurrealDbModuleProviders
  ],
  controllers: [
    // uncomment to expose SurrealDbController to consumer apps
    // SurrealDbController,
    // to use this preconfigured controller in consumer apps just use ir in `AppModule` `controllers: [SurrealDbController]`
    // and that should the way to go, package only exports and consumer use it or not
  ]
})
export class SurrealDbModule extends createConfigurableDynamicRootModule<
  SurrealDbModule,
  SurrealDbModuleOptions
>(SURREALDB_MODULE_OPTIONS, {}) { }