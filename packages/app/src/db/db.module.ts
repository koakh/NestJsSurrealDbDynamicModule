import { SurrealDbModule, SurrealDbService } from '@koakh/nestjs-surrealdb';
import { Module } from '@nestjs/common';
import { DbController } from './db.controller';
import { DbService } from './db.service';

@Module({
  // don't bring here global SurrealDbModule again
  // imports: [SurrealDbModule],
  providers: [DbService],
  controllers: [DbController]
})
export class DbModule {}
