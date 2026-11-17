import { APP_SERVICE, SurrealDbModule, SurrealDbController } from '@koakh/nestjs-surrealdb';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './config';
import { DbModule } from './db/db.module';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';

// graceful shutdown is implemented in the lib (SurrealDbService implements
// OnApplicationShutdown and closes the connection), enabled here by
// app.enableShutdownHooks() in main.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // since v0.2.0 (ConfigurableModuleBuilder) no need to pass the class ref as first argument
    SurrealDbModule.forRootAsync({
      useFactory: async (configService: ConfigService, userService: UserService) => ({
        url: configService.get('surrealDbUrl'),
        namespace: configService.get('surrealDbNamespace'),
        database: configService.get('surrealDbDatabase'),
        username: configService.get('surrealDbUsername'),
        password: configService.get('surrealDbPassword'),
        // userServiceAbstract
        userService,
        // set SURREALDB_INIT_SURREAL_DB=false to skip the connect on boot,
        // SURREALDB_INIT_SURREAL_DB_THROW_ERROR=false to log-and-continue on boot errors
        ...(configService.get('surrealDbInitSurrealDb') === 'false' ? { initSurrealDb: false } : {}),
        ...(configService.get('surrealDbInitSurrealDbThrowError') === 'false' ? { initSurrealDbThrowError: false } : {}),
        // set SURREALDB_CONTROLLER_GUARD_KEY to require `x-api-key` on every SurrealDbController endpoint
        ...(configService.get('surrealDbControllerGuardKey')
          ? { controllerGuard: (request: any) => request.headers['x-api-key'] === configService.get('surrealDbControllerGuardKey') }
          : {}),
      }),
      // this is required else we have error
      // Nest can't resolve dependencies of the SurrealDbService (AUTH_MODULE_OPTIONS, ?). Please make sure that the argument APP_SERVICE at index [1] is available in the SurrealDbModule context.
      imports: [AppModule, UserModule],
      inject: [ConfigService, UserService],
      // no need for this export, module already export's it
      // exports: [SurrealDbService],
    }),
    DbModule,
  ],
  controllers: [
    AppController,
    // uncomment to expose SurrealDbController to consumer apps
    SurrealDbController,
    // to use this preconfigured controller in consumer apps just use ir in `AppModule` `controllers: [SurrealDbController]`
    // and that should the way to go, package only exports and consumer use it or not
  ],
  providers: [
    // another trick is that this AppService is required to else we have the classic error
    // Nest can't resolve dependencies of the AppController (?, SurrealDbService). Please make sure that the argument AppService at index [0] is available in the AppModule context.
    {
      provide: APP_SERVICE,
      useClass: AppService,
    },
  ],
  // at last so kind of clue, this is what will solve the problem of 
  // ERROR [ExceptionHandler] Nest can't resolve dependencies of the SurrealDbService (AUTH_MODULE_OPTIONS, ?). Please make sure that the argument APP_SERVICE at index [1] is available in the SurrealDbModule context.
  // now we can import it with `imports: [AppModule]` into SurrealDbModule, and expose it's providers
  // this wat we use it inside it with `@Inject('APP_SERVICE')`
  exports: [
    {
      provide: APP_SERVICE,
      useClass: AppService,
    },
  ]
})

export class AppModule { }