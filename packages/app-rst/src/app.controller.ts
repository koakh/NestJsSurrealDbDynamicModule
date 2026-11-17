import { APP_SERVICE, SurrealDbModuleOptions, SurrealDbService, SurrealDbUser as User } from '@koakh/nestjs-surrealdb';
import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    // this is required else can't find dependency, is defined with TOKEN SYMBOL
    @Inject(APP_SERVICE)
    private readonly appService: AppService,
    private readonly surrealDbService: SurrealDbService,
  ) { }

  // local appService call
  @Get()
  getHello(): { message: string } {
    return { message: this.appService.getHello() };
  }

  // use passed config from consumerApp
  // NOTE: password is redacted, this endpoint must never leak credentials
  @Get('config')
  getConfig(): SurrealDbModuleOptions {
    return { ...this.surrealDbService.getConfig(), password: '***' };
  }

  // TODO: comment/uncomment to use/hide outside AppServiceAbstract
  // use app-lib > calling appService
  // @Get('app-service')
  // getHelloAppModule(): { message: string } {
  //   // Logger.log(JSON.stringify(this.SurrealDbService));
  //   return this.surrealDbService.getHelloAppModule();
  // }

  // use app-lib > calling userService
  @Get('user-service')
  async getUserFindOneByField(): Promise<User> {
    return this.surrealDbService.getUserFindOneByField();
  }

  // NOTE: surrealdb endpoints
  // we import and use SurrealDbController in AppModule controllers `packages/app-rst/src/app.module.ts`
}
