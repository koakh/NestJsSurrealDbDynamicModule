import { SurrealDbService } from '@koakh/nestjs-surrealdb';
import { Injectable } from '@nestjs/common';
import { UpdateRecipeInput } from './dto';
import { CreateRecipeInput } from './dto/create-recipe.input';
import { RecipesArgs } from './dto/recipes.args';
import { Recipe } from './entities';

@Injectable()
export class RecipesService {
  constructor(private readonly surrealDb: SurrealDbService) { }

  async create(data: CreateRecipeInput): Promise<Recipe> {
    return (await this.surrealDb.create(Recipe.name.toLowerCase(), {
      ...data,
      creationDate: new Date(),
    })) as Recipe;
  }

  // TODO: almost equal just use generics here or a base class
  async findAll({ skip, take }: RecipesArgs): Promise<Recipe[]> {
    // TODO: add surrealDb helper method with this sql in constants
    const query = `SELECT * FROM type::table($table) LIMIT ${take} START ${skip}`;
    // TODO: use vars with LIMIT and START
    // const query = 'SELECT * FROM type::table($table) LIMIT $limit START $start';
    const vars = { table: Recipe.name.toLowerCase(), start: skip, limit: take };
    const data = await this.surrealDb.query(query, vars);
    return data[0].result;
  }

  // TODO: almost equal just use generics here or a base class
  async findOne(id: string): Promise<Recipe[]> {
    const data = await this.surrealDb.select(id);
    // should not get here if we pass above validation
    if (data && Array.isArray(data) && data.length > 1) {
      throw new Error('found more than one record');
    }
    return data && Array.isArray(data) && data.length === 1
      ? (data[0] as unknown as Recipe[])
      : [];
  }

  async update(id: string, data: UpdateRecipeInput): Promise<Recipe> {
    return (await this.surrealDb.change(id, data)) as any as Recipe;
  }

  async remove(id: string): Promise<boolean> {
    await this.surrealDb.delete(id);
    return true;
  }
}
