import { APP_SERVICE, SurrealDbService } from '@koakh/nestjs-surrealdb';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        // AppController injects the APP_SERVICE token and SurrealDbService
        { provide: APP_SERVICE, useExisting: AppService },
        { provide: SurrealDbService, useValue: {} },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return hello message', () => {
      expect(appController.getHello()).toEqual({ message: 'Hello World from AppModule::AppService!' });
    });
  });
});
