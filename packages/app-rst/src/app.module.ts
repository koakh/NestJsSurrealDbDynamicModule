import { APP_SERVICE, SurrealDbModule, SurrealDbController } from '@koakh/nestjs-surrealdb';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './config';
import { DbModule } from './db/db.module';
import { UserModule } from './user/user.module';
import { UserService } from './user/user.service';

// TODO: implement on shutdown close connection to surrealdb
// this will enable @Inject(APP_SERVICE) on DbService
// @Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SurrealDbModule.forRootAsync(SurrealDbModule, {
      useFactory: async (configService: ConfigService, userService: UserService) => ({
        url: configService.get('surrealDbUrl'),
        namespace: configService.get('surrealDbNamespace'),
        database: configService.get('surrealDbDatabase'),
        username: configService.get('surrealDbUsername'),
        password: configService.get('surrealDbPassword'),
        initSurrealDbThrowError: configService.get('surrealdbInitSurrealDbThrowError'),
        // userServiceAbstract
        userService,
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