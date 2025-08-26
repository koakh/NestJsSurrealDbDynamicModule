import { APP_SERVICE, SurrealDbModuleOptions, SurrealDbService, SurrealDbUser as User } from '@koakh/nestjs-surrealdb';
import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { CreatePersonDto } from './dto';

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
  @Get('config')
  getConfig(): SurrealDbModuleOptions {
    return this.surrealDbService.getConfig();
  }

  // TODO: comment/uncomment to use/hide outside AppServiceAbstract
  // use app-lib > calling appService
  // @Get('appservice')
  // getHelloAppModule(): { message: string } {
  //   // Logger.log(JSON.stringify(this.SurrealDbService));
  //   return this.surrealDbService.getHelloAppModule();
  // }

  // use app-lib > calling userService
  @Get('userservice')
  async getUserFindOneByField(): Promise<User> {
    return this.surrealDbService.getUserFindOneByField();
  }

  @Post('/person/create/:thing')
  async personCreate(
    @Param('thing') thing: string, 
    @Body() createDto: CreatePersonDto
  ): Promise<Array<CreatePersonDto & { id: string }>> {
    const result = await this.surrealDbService.create(thing, createDto);
    // Type assertion to match your return type
    return result as unknown as Array<CreatePersonDto & { id: string }>;
  }

  // NOTE: surrealdb endpoints
  // we import and use SurrealDbController in AppModule controllers `packages/app-rst/src/app.module.ts`
  // and it will be automatically exposed to consumer app
}
