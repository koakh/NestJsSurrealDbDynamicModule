import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

  catch(exception: unknown, host: ArgumentsHost): void {
    // expected HttpExceptions (4xx from validation and the error mappings) log
    // as a compact one-liner — the stack is noise for handled flows; unexpected
    // errors keep the full object + stack, that's where debugging needs it
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const extra = typeof response === 'object' ? ` ${JSON.stringify(response)}` : '';
      Logger.error(`${exception.name}: ${exception.message}${extra}`, AllExceptionsFilter.name);
    } else {
      Logger.error(exception, AllExceptionsFilter.name);
    }
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // don't leak internal error details to clients on unexpected errors,
    // full details are kept in the log above
    const message =
      exception instanceof HttpException
        ? `${(exception as any)?.name} : ${(exception as any)?.message}`
        : 'Internal server error';

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}