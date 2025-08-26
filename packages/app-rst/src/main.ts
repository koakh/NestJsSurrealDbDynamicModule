import { BadRequestException, LogLevel, Logger, LoggerService, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters';

async function bootstrap() {
  const context = 'NestApplication';
  const logger: LoggerService | LogLevel[] | false = process.env.NODE_ENV === 'development'
    ? ['log', 'error', 'warn', 'debug', 'verbose']
    : ['log', 'error', 'warn'];

  // Create app
  const app = await NestFactory.create(AppModule, { logger });
  // Get app instances
  const AppHttpAdapter = app.get(HttpAdapterHost);
  const configService = app.get<ConfigService>(ConfigService);
  // Config vars
  const httpServerPort = configService.get<string>('httpServerPort');
  // Middleware
  app.useGlobalFilters(new AllExceptionsFilter(AppHttpAdapter));
  // Updated ValidationPipe with proper configuration and debugging
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    stopAtFirstError: false,
    disableErrorMessages: false,
    validateCustomDecorators: true,
    // Add this for debugging
    exceptionFactory: (errors) => {
      Logger.error('Validation errors detected:', context);
      errors.forEach(e => { Logger.error(String(e).replace(/\n/g, '').replace(/^An instance of \w+ has failed the validation: /, ''), context); });
      return new BadRequestException({
        message: 'Validation failed',
        // doesn't work
        errors,
        timestamp: new Date().toISOString(),
      });
    },
  }));
  // required to output in debug mode (launch.json) that doesn't show anything with logger
  // console.log(`logger: process.env.NODE_ENV, logger level: [${process.env.NODE_ENV}], ${logger}`);

  // Start server
  await app.listen(httpServerPort);
  Logger.log(`Application is running on: ${await app.getUrl()}`, context);
  Logger.log(`using surrealDb host: ${configService.get('surrealDbUrl')}`, context);
}
bootstrap();
