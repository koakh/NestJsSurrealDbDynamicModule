import { Inject, Injectable, Logger } from '@nestjs/common';
// tslint:disable-next-line:max-line-length
import { AccessRecordAuth, ActionResult, AnyAuth, default as Auth, ExportOptions, Fill, LiveHandler, MapQueryResult, Patch, PreparedQuery, Prettify, QueryParameters, RecordId, RecordIdRange, ResponseError, RpcResponse, ScopeAuth, StringRecordId, default as Surreal, Table, Uuid } from 'surrealdb';
import { UserServiceAbstract } from './surrealdb.abstracts';
import { SURREALDB_MODULE_OPTIONS, SURREALDB_MODULE_USER_SERVICE, adminCurrentUser } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';
import { RecordId$1, SurrealDbUser as User } from './types';

@Injectable()
export class SurrealDbService {
  private db: Surreal;

  constructor(
    @Inject(SURREALDB_MODULE_OPTIONS)
    private readonly options: SurrealDbModuleOptions,
    @Inject(SURREALDB_MODULE_USER_SERVICE)
    private readonly userService: UserServiceAbstract,
    // TODO: comment/uncomment to use/hide outside AppServiceAbstract
    // WARN: this is only useful in debug mode, but gives problems in consumer apps, because they don't implement this service, always leave uncomment to prevent issues, and use only for tests in dev env
    // tslint:disable-next-line:max-line-length
    // Nest can't resolve dependencies of the SurrealDbService (Symbol(SURREALDB_MODULE_OPTIONS), Symbol(SURREALDB_MODULE_USER_SERVICE), ?). Please make sure that the argument Symbol(APP_SERVICE) at index [2] is available in the SurrealDbModule context.
    // @Inject(APP_SERVICE)
    // private readonly appService: AppServiceAbstract,
  ) {
    if (!options.initSurrealDb || !options.initSurrealDb === false) {
      this.initSurrealDb(options.initSurrealDbThrowError);
    }
  }

  // SurrealDbModuleOptions
  getConfig(): SurrealDbModuleOptions {
    return this.options;
  }

  // TODO: comment/uncomment to use/hide outside AppServiceAbstract
  // example
  // appServiceAbstract: this is from consumer app AppModule/AppService
  // getHelloAppModule(): { message: string } {
  //   return { message: `${this.appService.getHello()} (called in SurrealDbService.getHelloAppModule())` };
  // }

  // example
  // userServiceAbstract: this is from consumer app AppModule/UserService
  getUserFindOneByField(): Promise<User> {
    return this.userService.findOneByField('username', 'admin', adminCurrentUser);
  }

  // initSurrealDb

  private async initSurrealDb(throwError: boolean = true): Promise<Surreal> {
    this.db = new Surreal();
    const { url, namespace, database, username, password, userService } = this.options;
    try {
      // this appear on start of server log, after `[InstanceLoader] ConfigModule dependencies initialize`
      // Logger.log(`url: ${url}, namespace: ${namespace}, database: ${database}, username: ${username}, password: ${password}`, SurrealDbService.name);
      await this.db.connect(url, { namespace, database, auth: { username, password } });
      // already defined above
      // await this.db.use({ namespace, database });
      // in new version surrealdb v2.3.7, this is required
      // await this.db.signin({ username, password });
      // wait for the connection to the database to succeed
      Logger.verbose(`surrealdb database is ready url: ${url}, namespace: ${namespace}, database: ${database}`, SurrealDbService.name);
      await this.db.ready;
      return this.db;
    } catch (error) {
      // tslint:disable-next-line:no-console
      Logger.error(`Failed to connect to SurrealDB at url: ${url}, namespace: ${namespace}, database: ${database}: ${error instanceof Error ? error.message : String(error)}`, SurrealDbService.name);
      await this.db.close();
      // use false on c3-backend to prevent a crash o app boot
      if (throwError) {
        throw error;
      }
    }
  }

  // helper methods

  /**
   * check if thing exists if passed id with entity, else does nothing
   * @param thing
   */
  async thingExists(thing: string): Promise<void> {
    if (thing.split(':').length === 2) {
      if (!await this.db.select(thing)) {
        // mimic surrealdb response
        throw new Error(`Record not found: ${thing}`);
      }
    }
  }

  /**
   * generate a RecordId from a string
   * @param thing
   */
  async recordIdFromStringThing(thing: string): Promise<RecordId | string> {
    if (typeof thing === 'string') {
      const [table, id] = thing.split(':');
      if (table && id) {
        return new RecordId(table, id);
      } else {
        return thing;
      }
    }
    return thing;
  }

  // surrealDb Proxy methods

  /**
   * Establish a socket connection to the database
   * @param connection - Connection details
   */
  async connect(
    url: string | URL,
    opts?: {
      namespace?: string;
      database?: string;
      auth?: string | AnyAuth;
      prepare?: (connection: Auth) => unknown;
      versionCheck?: boolean;
      versionCheckTimeout?: number;
    },
  ): Promise<true> {
    return await this.db.connect(url, opts || this.options);
  }

  /**
   * Disconnect the socket to the database
   */
  async close(): Promise<true> {
    return await this.db.close();
  }

  /**
   * Ping SurrealDB instance
   */
  async ping(): Promise<true> {
    return await this.db.ping();
  }

  /**
   * Switch to a specific namespace and database.
   * @param database - Switches to a specific namespace.
   * @param db - Switches to a specific database.
   */
  async use(namespace?: string, database?: string): Promise<true> {
    return await this.db.use({ namespace, database });
  }

  /**
   * Selects everything from the [$auth](https://surrealdb.com/docs/surrealql/parameters) variable.
   * ```sql
   * SELECT * FROM $auth;
   * ```
   * Make sure the user actually has the permission to select their own record, otherwise you'll get back an empty result.
   * @return The record linked to the record ID used for authentication
   */
  async info<T extends Record<string, unknown>>(): Promise<ActionResult<T> | undefined> {
    return await this.db.info<T>();
  }

  /**
   * Signs up to a specific authentication scope.
   * @param vars - Variables used in a signup query.
   * @return The authentication token.
   */
  async signup(vars: ScopeAuth | AccessRecordAuth): Promise<string> {
    // await this.db.use({ namespace: 'test', database: 'test' });
    return await this.db.signup(vars).catch((e) => {
      throw new ResponseError(`signup error${e.message ? `: ${e.message}` : ''}`);
    });
  }

  /**
   * Signs in to a specific authentication scope.
   * @param vars - Variables used in a signin query.
   * @return The authentication token.
   */
  async signin(vars: AnyAuth): Promise<string> {
    return await this.db.signin(vars).catch(() => { throw new ResponseError('signup error'); });
  }

  /**
   * Authenticates the current connection with a JWT token.
   * @param token - The JWT authentication token.
   */
  async authenticate(token: string): Promise<true> {
    return await this.db.authenticate(token);
  }

  /**
   * Invalidates the authentication for the current connection.
   */
  async invalidate(): Promise<true> {
    return await this.db.invalidate();
  }

  /**
   * Specify a variable for the current socket connection.
   * @param variable - Specifies the name of the variable.
   * @param value - Assigns the value to the variable name.
   */
  async let(variable: string, value: any): Promise<true> {
    return await this.db.let(variable, value);
  }

  /**
   * Remove a variable from the current socket connection.
   * @param key - Specifies the name of the variable.
   */
  async unset(variable: string): Promise<true> {
    return this.db.unset(variable);
  }

  /**
   * Start a live select query and invoke the callback with responses
   * @param table - The table that you want to receive live results for.
   * @param callback - Callback function that receives updates.
   * @param diff - If set to true, will return a set of patches instead of complete records
   * @returns A unique subscription ID
   */
  async live<Result extends Record<string, unknown> | Patch = Record<string, unknown>>(table: RecordIdRange | Table | string, callback?: LiveHandler<Result>, diff?: boolean): Promise<Uuid> {
    return (await this.db.live<Result>(table, callback));
  }

  /**
   * Subscribe to an existing live select query and invoke the callback with responses
   * @param queryUuid - The unique ID of an existing live query you want to receive updates for.
   * @param callback - Callback function that receives updates.
   */
  async subscribeLive<Result extends Record<string, unknown> | Patch = Record<string, unknown>>(queryUuid: Uuid, callback: LiveHandler<Record<string, unknown>>): Promise<void> {
    return await this.db.subscribeLive<Result>(queryUuid, callback);
  }

  /**
   * Unsubscribe a callback from a live select query
   * @param queryUuid - The unique ID of an existing live query you want to unsubscribe from.
   * @param callback - The previously subscribed callback function.
   */
  async unSubscribeLive<Result extends Record<string, unknown> | Patch = Record<string, unknown>>(queryUuid: Uuid, callback: LiveHandler<Result>): Promise<void> {
    return await this.db.unSubscribeLive<Result>(queryUuid, callback);
  }

  /**
   * Kill a live query
   * @param queryUuid - The query that you want to kill.
   */
  async kill(queryUuid: Uuid | readonly Uuid[]): Promise<void> {
    return this.db.kill(queryUuid);
  }

  /**
   * Runs a set of SurrealQL statements against the database.
   * @param query - Specifies the SurrealQL statements.
   * @param bindings - Assigns variables which can be used in the query.
   */
  async query<T extends unknown[]>(...args: QueryParameters): Promise<Prettify<T>> {
    return await this.db.query<T>(...args);
  }

  /**
   * Runs a set of SurrealQL statements against the database.
   * @param query - Specifies the SurrealQL statements.
   * @param bindings - Assigns variables which can be used in the query.
   * @borrows https://chatgpt.com/c/6745f7e3-bd4c-8004-b607-2d4d747773a5
   */
  async queryRaw<T extends unknown[]>(...params: [prepared: PreparedQuery, gaps?: Array<Fill<unknown>>]): Promise<Prettify<MapQueryResult<T>>> {
    return await this.db.queryRaw<T>(...params);
  }

  /**
   * Selects all records in a table, or a specific record, from the database.
   * If you intend on sorting, filtering, or performing other operations on the data, it is recommended to use the `query` method instead.
   * @param thing - The table name or a record ID to select.
   */
  async select<T extends { [x: string]: unknown; }>(thing: RecordId$1 | RecordIdRange | Table | string)
    : Promise<ActionResult<T> | Promise<Array<ActionResult<T>>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.select<T>(new StringRecordId(thing.toString()));
    } else {
      // if is a table
      return await this.db.select<T>(thing.toString());
    }
  }

  /**
   * Creates a record in the database.
   * @param thing - The table name or the specific record ID to create.
   * @param data - The document / record data to insert.
   */
  async create<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T>(thing: string | Table<string>, data?: any): Promise<Array<{ [x: string]: unknown; id: RecordId<string>; }>> {

    // TODO: use generic types in all operations

    // tslint:disable-next-line:interface-over-type-literal
    type Person = {
      // id: string;
      name: string;
      settings: {
        active: boolean;
        marketing: boolean;
      };
    };

    // tslint:disable-next-line:interface-over-type-literal disable-next-line:no-shadowed-variable
    type User = {
      age: number,
      marketing: boolean,
      name: {
        first: string,
        last: string,
      },
      title: string,
    };

    // Create a record with a random ID
    // const [person] = await this.db.create<Person>('person');
    // Create a record with a specific ID
    // const person = await this.db.create<Person>(new RecordId('person', 'tobie'), {
    //   name: 'Tobie',
    //   settings: {
    //     active: true,
    //     marketing: true,
    //   },
    // });
    // Logger.log(`person: [${JSON.stringify(person, undefined, 2)}]`);

    return await this.db.create<User>(await this.recordIdFromStringThing(thing as string), data);
  }

  /**
   * Inserts one or multiple records in the database.
   * @param table - The table name to insert into.
   * @param data - The document(s) / record(s) to insert.
   */
  async insert<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T>(thing: string | Table<string>, data?: any): Promise<Array<{ [x: string]: unknown; id: RecordId<string>; }>> {
    return await this.db.insert<T, U>(thing, data);
  }

  /**
   * Inserts one or multiple records in the database.
   * @param thing - The table name or the specific record ID to create.
   * @param data - The document(s) / record(s) to insert.
   */
  async insertRelation<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T = T>(table: string | Table<string>, data?: any): Promise<Array<ActionResult<T>>> {
    return await this.db.insertRelation<T, U>(table, data);
  }

  /**
   * Updates all records in a table, or a specific record, in the database.
   *
   * ***NOTE: This function replaces the current document / record data with the specified data.***
   * @param thing - The table name or the specific record ID to update.
   * @param data - The document / record data to insert.
   */
  async update<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T>(thing: RecordIdRange | Table | string, data: U): Promise<ActionResult<T> | Array<ActionResult<T>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.update<T, U>(new StringRecordId(thing.toString()), data);
    } else {
      // if is a table
      return await this.db.update<T, U>(thing.toString(), data);
    }
  }

  /**
   * Upserts all records in a table, or a specific record, in the database.
   *
   * ***NOTE: This function replaces the current document / record data with the specified data.***
   * @param thing - The table name or the specific record ID to upsert.
   * @param data - The document / record data to insert.
   */
  async upsert<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T>(thing: string | Table<string> | RecordIdRange<string>, data?: any): Promise<ActionResult<T> | Array<ActionResult<T>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.upsert<T, U>(new StringRecordId(thing.toString()), data);
    } else {
      // if is a table
      return await this.db.upsert<T, U>(thing.toString(), data);
    }
  }

  /**
   * Modifies all records in a table, or a specific record, in the database.
   *
   * ***NOTE: This function merges the current document / record data with the specified data.***
   * @param thing - The table name or the specific record ID to change.
   * @param data - The document / record data to insert.
   */
  async merge<T extends { [x: string]: unknown; id: RecordId<string> }, U extends T>(thing: string | Table<string> | RecordIdRange<string>, data?: any): Promise<ActionResult<T> | Array<ActionResult<T>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.merge<T, U>(new StringRecordId(thing.toString()), data);
    } else {
      // if is a table
      return await this.db.merge<T, U>(thing.toString(), data);
    }
  }

  /**
   * Applies JSON Patch changes to all records, or a specific record, in the database.
   *
   * ***NOTE: This function patches the current document / record data with the specified JSON Patch data.***
   * @param thing - The table name or the specific record ID to modify.
   * @param data - The JSON Patch data with which to modify the records.
   */
  async patch<T extends { [x: string]: unknown; id: RecordId<string> }>(thing: string | Table<string> | RecordIdRange<string>, data?: any): Promise<ActionResult<T> | Array<ActionResult<T>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.patch<T>(new StringRecordId(thing.toString()), data);
    } else {
      // if is a table
      return await this.db.patch<T>(thing.toString(), data);
    }
  }

  /**
   * Deletes all records in a table, or a specific record, from the database.
   * @param thing - The table name or a record ID to select.
   */
  async delete<T extends { [x: string]: unknown; id: RecordId<string> }>(thing: string | Table<string> | RecordIdRange<string>): Promise<ActionResult<T> | Array<ActionResult<T>>> {
    if (thing.toString().split(':').length === 2) {
      // if is a recordId
      await this.thingExists(thing.toString());
      return await this.db.delete<T>(new StringRecordId(thing.toString()));
    } else {
      // if is a table
      return await this.db.delete<T>(thing.toString());
    }
  }

  /**
   * Obtain the version of the SurrealDB instance
   * @example `surrealdb-2.1.0`
   */
  async version(): Promise<string> {
    return await this.db.version();
  }

  /**
   * Overload signature
   * Run a SurrealQL function
   * @param name - The full name of the function
   * @param args - The arguments supplied to the function. You can also supply a version here as a string, in which case the third argument becomes the parameter list.
   */
  async run<T>(name: string, args?: unknown[]): Promise<T>;
  /**
   * Overload signature
   * Run a SurrealQL function
   * @param name - The full name of the function
   * @param version - The version of the function. If omitted, the second argument is the parameter list.
   * @param args - The arguments supplied to the function.
   */
  async run<T>(name: string, version: string, args?: unknown[]): Promise<T>;
  // Implementation
  async run<T>(name: string, versionOrArgs?: string | unknown[], args?: unknown[]): Promise<T> {
    // Handle the arguments based on their types
    if (Array.isArray(versionOrArgs)) {
      // Called as run(name, args)
      return await this.db.run<T>(name, undefined, versionOrArgs);
    } else {
      // Called as run(name, version, args)
      return await this.db.run<T>(name, versionOrArgs, args);
    }
  }

  /**
   * Obtain the version of the SurrealDB instance
   * @param from - The in property on the edge record
   * @param thing - The id of the edge record
   * @param to - The out property on the edge record
   * @param data - Optionally, provide a body for the edge record
   */
  async relate<T extends { [x: string]: unknown; }, U extends T = T>(
    from: string | RecordId$1 | RecordId$1[],
    thing: RecordId$1,
    to: string | RecordId$1 | RecordId$1[],
    data?: U)
    : Promise<T> {
    return await this.db.relate<T, U>(from, thing, to, data);
  }

  /**
   * Send a raw message to the SurrealDB instance
   * @param method - Type of message to send.
   * @param params - Parameters for the message.
   */
  async rpc<Result>(method: string, params?: unknown[]): Promise<RpcResponse<Result>> {
    return await this.db.rpc<Result>(method, params);
  }

  /**
   * Export the database and return the result as a string
   * @param options - Export configuration options
   */
  async export(options?: Partial<ExportOptions>): Promise<string> {
    return await this.db.export(options);
  }
}
