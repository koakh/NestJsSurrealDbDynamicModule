import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters';

// process guard: log unexpected errors and keep the app alive instead of
// crashing (default ON). crash-fast is the node default and the right posture
// under a supervisor (docker restart / pm2 / k8s) — this protects the bare dev app
if (process.env.PROCESS_GUARD !== 'false') {
  process.on('unhandledRejection', (reason) => {
    Logger.error(`unhandledRejection: ${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`, 'ProcessGuard');
  });
  process.on('uncaughtException', (error) => {
    Logger.error(`uncaughtException: ${error.stack ?? error.message}`, 'ProcessGuard');
  });
}

async function bootstrap() {
  const context = 'NestApplication';
  const app = await NestFactory.create(AppModule);
  // get app instances
  const AppHttpAdapter = app.get(HttpAdapterHost);  
  const configService = app.get<ConfigService>(ConfigService);
  // config vars
  const httpServerPort = configService.get<string>('httpServerPort');
  // middleware
  app.useGlobalFilters(new AllExceptionsFilter(AppHttpAdapter));
  app.useGlobalPipes(new ValidationPipe({
    transform: true,          // auto-transform DTOs
    whitelist: true,          // strip non-whitelisted properties
    forbidNonWhitelisted: true, // throw on non-whitelisted properties
  }));
  // enable graceful shutdown hooks (SurrealDbService.onApplicationShutdown closes the connection)
  app.enableShutdownHooks();
  // start server
  await app.listen(httpServerPort);
  Logger.log(`Application is running on: ${await app.getUrl()}`, context);
  Logger.log(`using surrealDb host: ${configService.get('surrealDbUrl')}`, context);
}
bootstrap();
