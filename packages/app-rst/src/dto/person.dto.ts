import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PersonName {
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
  readonly name: PersonName;

  @IsBoolean()
  @IsOptional()
  readonly marketing?: boolean;
}
