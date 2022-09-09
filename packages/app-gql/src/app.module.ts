import { APP_SERVICE, SurrealDbModule } from '@koakh/nestjs-surrealdb';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { DirectiveLocation, GraphQLDirective } from 'graphql';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { upperDirectiveTransformer } from './common/directives/upper-case.directive';
import { configuration } from './config';
import { RecipesModule } from './recipes/recipes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SurrealDbModule.forRootAsync(SurrealDbModule, {
      useFactory: async (configService: ConfigService) => ({
        url: configService.get('SURREALDB_URL'),
        namespace: configService.get('SURREALDB_NAMESPACE'),
        database: configService.get('SURREALDB_DATABASE'),
        user: configService.get('SURREALDB_USER'),
        pass: configService.get('SURREALDB_PASS'),
      }),
      imports: [AppModule],
      inject: [ConfigService],
    }),
    RecipesModule,
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
        transformSchema: (schema) => upperDirectiveTransformer(schema, 'upper'),
        buildSchemaOptions: {
          directives: [
            new GraphQLDirective({
              name: 'upper',
              locations: [DirectiveLocation.FIELD_DEFINITION],
            }),
          ],
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
  ],
})
export class AppModule {}