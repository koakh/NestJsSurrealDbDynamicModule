import { RecordId$1 } from '@koakh/nestjs-surrealdb';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsObject, IsPositive, IsString, ValidateNested } from 'class-validator';

class PersonName {
  @IsString()
  @IsNotEmpty()
  readonly first: string;

  @IsString()
  @IsNotEmpty()
  readonly last: string;
}

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PersonName)
  @IsNotEmpty()
  readonly name: PersonName;

  @IsBoolean()
  readonly marketing: boolean;

  @IsNumber()
  @IsPositive()
  readonly age: number;
}

// This is not used anymore, only if we opt to use generic types in `async create<T extends Record<string, unknown>>(`

// SurrealDB-compatible User type
export type CreatePersonSurrealType = Omit<CreatePersonDto, 'id'> & {
  id: RecordId$1<string>;
};

// Simplified generic helper - always adds RecordId regardless of original id type
export type WithSurrealId<T> = Omit<T, 'id'> & { id: RecordId$1<string> };

// Helper for input data (without id)
export type SurrealInput<T> = Omit<T, 'id'>;
