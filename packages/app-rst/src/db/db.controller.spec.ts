import { SurrealDbService } from '@koakh/nestjs-surrealdb';
import { Test, TestingModule } from '@nestjs/testing';
import { DbController } from './db.controller';
import { DbService } from './db.service';

describe('DbController', () => {
  let controller: DbController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DbController],
      providers: [
        { provide: SurrealDbService, useValue: {} },
        { provide: DbService, useValue: { getUserFindOneByField: () => Promise.resolve({}) } },
      ],
    }).compile();

    controller = module.get<DbController>(DbController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
