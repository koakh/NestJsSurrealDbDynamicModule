import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SurrealDbService } from './surrealdb.service';

/**
 * applies the opt-in `controllerGuard` from `SurrealDbModuleOptions`
 * to every `SurrealDbController` endpoint
 *
 * - no guard configured: all requests allowed (default, back-compatible)
 * - guard returns `false`: rejected with 403 Forbidden
 * - guard throws an `HttpException`: the exception is returned as-is
 */
@Injectable()
export class SurrealDbControllerGuard implements CanActivate {
  constructor(private readonly surrealDbService: SurrealDbService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const guard = this.surrealDbService.getConfig()?.controllerGuard;
    if (!guard) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    // treat `undefined` (a void return) as allowed, only an explicit `false` rejects
    const result = await guard(request);
    return result !== false;
  }
}
