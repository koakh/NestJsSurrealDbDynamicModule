import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';

async function bootstrap() {
  const context = 'NestApplication';
  const app = await NestFactory.create(AppModule);
  // get app instances
  const AppHttpAdapter = app.get(HttpAdapterHost);
  const configService = app.get<ConfigService>(ConfigService);
  // config vars
  const graphqlServerPort = configService.get<string>('graphqlServerPort');
  const surrealDbUrl = configService.get('surrealDbUrl');
  // middleware
  app.useGlobalFilters(new AllExceptionsFilter(AppHttpAdapter));
  app.useGlobalPipes(new ValidationPipe());
  // start server
  await app.listen(graphqlServerPort);
  Logger.log(`Application is running on: ${await app.getUrl()}`, context);
  Logger.log(`Using surrealDb host: ${surrealDbUrl}`, context);
}
bootstrap();
