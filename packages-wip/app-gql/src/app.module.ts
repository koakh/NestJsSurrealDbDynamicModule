import { Transform } from 'class-transformer';
import { APP_SERVICE, SurrealDbModule } from '@koakh/nestjs-surrealdb';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { DataloaderModule } from '@koakh/nestjs-dataloader';
import { DirectiveLocation, GraphQLDirective } from 'graphql';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './common/config';
import { upperDirectiveTransformer } from './common/directives/upper-case.directive';
import { RecipesModule } from './recipes/recipes.module';
import { RestaurantsModule } from './restaurants/restaurants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    SurrealDbModule.forRootAsync(SurrealDbModule, {
      useFactory: async (configService: ConfigService) => ({
        url: configService.get('surrealDbUrl'),
        namespace: configService.get('surrealDbNamespace'),
        database: configService.get('surrealDbDatabase'),
        username: configService.get('surrealDbUsername'),
        password: configService.get('surrealDbPassword'),
      }),
      imports: [AppModule],
      inject: [ConfigService],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), configService.get<string>('graphqlAutoSchemaFile')),
        installSubscriptionHandlers: true,        
        // prevent `server is vulnerable to denial of service attacks via memory exhaustion`
        cache: 'bounded',
        transformSchema: (schema) => upperDirectiveTransformer(schema, 'upper'),
        buildSchemaOptions: {
          directives: [
            new GraphQLDirective({
              name: 'upper',
              locations: [DirectiveLocation.FIELD_DEFINITION],
            }),
          ],
        },
        // if defined will be always true, or always false, ignoring NODE_ENV
        // debug: false,
        formatError: (error) => {
          // Don't give the specific errors to the client.
          // if (err.message.startsWith('Database Error: ')) {
          //   return new Error('Internal server error');
          // }
          if (error.extensions?.code === 'INTERNAL_SERVER_ERROR') {
            // return an object with message and extensions instead of new Error()
            return {
              message: error.message,
              extensions: error.extensions
            };
          }
          // Fallback to returning the original error if it doesn't match the condition
          // Otherwise return the original error. The error can also
          // be manipulated in other ways, as long as it's returned.
          return error;
        },
      }),
    }),
    DataloaderModule,
    RecipesModule,
    RestaurantsModule,
  ],
  controllers: [AppController],
  // TODO: comment/uncomment to use/hide outside AppServiceAbstract
  providers: [
    AppService,
    // another trick is that this AppService is required to else we have the classic error
    // Nest can't resolve dependencies of the AppController (?, SurrealDbService). Please make sure that the argument AppService at index [0] is available in the AppModule context.
    {
      provide: APP_SERVICE,
      useClass: AppService,
    },
  ],
  // // at last so kind of clue, this is what will solve the problem of
  // // ERROR [ExceptionHandler] Nest can't resolve dependencies of the SurrealDbService (AUTH_MODULE_OPTIONS, ?). Please make sure that the argument APP_SERVICE at index [1] is available in the SurrealDbModule context.
  // // now we can import it with `imports: [AppModule]` into SurrealDbModule, and expose it's providers
  // // this wat we use it inside it with `@Inject('APP_SERVICE')`
  // exports: [
  //   {
  //     provide: APP_SERVICE,
  //     useClass: AppService,
  //   },
  // ],
})
export class AppModule { }
