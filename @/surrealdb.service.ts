import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActionResult, AnyAuth, default as Auth, ExportOptions, RecordId, RpcResponse, default as Surreal } from 'surrealdb';
import { UserServiceAbstract } from './surrealdb.abstracts';
import { RECONNECT_TIMEOUT_INTERVAL, SURREALDB_MODULE_OPTIONS, SURREALDB_MODULE_USER_SERVICE, adminCurrentUser } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';
import { SurrealDbUser } from './types';

@Injectable()
export class SurrealDbService {
  private db: Surreal;

  constructor(
    @Inject(SURREALDB_MODULE_OPTIONS)
    private readonly config: SurrealDbModuleOptions,
    @Inject(SURREALDB_MODULE_USER_SERVICE)
    private readonly userService: UserServiceAbstract,
    // TODO: comment/uncomment to use/hide outside AppServiceAbstract
    // WARN: this is only useful in debug mode, but gives problems in consumer apps, because they don't implement this service, always leave uncomment to prevent issues, and use only for tests in dev env
    // tslint:disable-next-line:max-line-length
    // Nest can't resolve dependencies of the SurrealDbService (Symbol(SURREALDB_MODULE_OPTIONS), Symbol(SURREALDB_MODULE_USER_SERVICE), ?). Please make sure that the argument Symbol(APP_SERVICE) at index [2] is available in the SurrealDbModule context.
    // @Inject(APP_SERVICE)
    // private readonly appService: AppServiceAbstract,
  ) {
    if (!config.initSurrealDb || !config.initSurrealDb === false) {
      this.reconnectTimeoutInterval = setInterval(() => {
        if (this.db && this.db.status) {
          Logger.log(`Re-connect to surrealdb, current status: ${this.db.status}`, SurrealDbService.name);
        } else {
          Logger.log(`Connect to surrealdb...`, SurrealDbService.name);
        }
        this.initSurrealDb(config.initSurrealDbThrowError);
      }, RECONNECT_TIMEOUT_INTERVAL);
    }
  }

  private reconnectTimeoutInterval: NodeJS.Timeout;
  private connectedToDb = false;
  private subscribedToConnectionEvents = false;

  // SurrealDbModuleOptions
  getConfig(): SurrealDbModuleOptions {
    return this.config;
  }

  // TODO: comment/uncomment to use/hide outside AppServiceAbstract
  // example
  // appServiceAbstract: this is from consumer app AppModule/AppService
  // getHelloAppModule(): { message: string } {
  //   return { message: `${this.appService.getHello()} (called in SurrealDbService.getHelloAppModule())` };
  // }

  // example
  // userServiceAbstract: this is from consumer app AppModule/UserService
  getUserFindOneByField(): Promise<SurrealDbUser> {
    return this.userService.findOneByField('username', 'admin', adminCurrentUser);
  }

  // initSurrealDb

  private async initSurrealDb(throwError: boolean = true) {
    await this.getDb(throwError);
  }

  private async getDb(throwError: boolean = true): Promise<Surreal> {
    if (this.db && this.db.status !== 'disconnected') {
      return this.db;
    }

    const { url, namespace, database, username, password, userService } = this.config;
    this.db = new Surreal();
    this.subscribedToConnectionEvents = false;

    try {
      // this appear on start of server log, after `[InstanceLoader] ConfigModule dependencies initialize`
      // Logger.log(`url: ${url}, namespace: ${namespace}, database: ${database}, username: ${username}, password: ${password}`, SurrealDbService.name);
      await this.db.connect(url, {
        namespace, database,
        // When set to `false`, the driver will remain disconnected after a connection is lost.
        // When set to `true`, the driver will attempt to reconnect using default options.
        // When set to an object, the driver will attempt to reconnect using the provided options.
        reconnect: true,
        renewAccess: true,
        versionCheck: false,
        // authentication: { username, password },
        authentication: () => {
          if (!this.subscribedToConnectionEvents) {
            const unsubReconnecting = this.db.subscribe('reconnecting', () => {
              Logger.log('Reconnecting to surrealDb', SurrealDbService.name);
            });
            const unsubConnected = this.db.subscribe('connected', () => {
              Logger.log('Connected to surrealDb', SurrealDbService.name);
            });
            const unsubDisconnected = this.db.subscribe('disconnected', () => {
              Logger.log('Disconnected from surrealDb', SurrealDbService.name);
            });
            const unsubConnecting = this.db.subscribe('connecting', () => {
              Logger.log('Connecting to surrealDb', SurrealDbService.name);
            });
            const unsubInvalidated = this.db.subscribe('invalidated', () => {
              Logger.log('Invalidated from surrealDb', SurrealDbService.name);
            });
            const unsubError = this.db.subscribe('error', () => {
              Logger.log('Error in surrealDb', SurrealDbService.name);
            });
            this.subscribedToConnectionEvents = true;
          }
          return {
            username,
            password,
            namespace,
          };
        },
      });
      // already defined above
      // await this.db.use({ namespace, database });
      // in new version surrealdb v2.3.7, this is required
      // await this.db.signin({ username, password });
      // wait for the connection to the database to succeed
      Logger.verbose(`surrealdb database is ready url: ${url}, namespace: ${namespace}, database: ${database}`, SurrealDbService.name);
      await this.db.ready;
      this.connectedToDb = true;
      // clear reconnect timeout
      clearTimeout(this.reconnectTimeoutInterval);

      return this.db;
    } catch (error) {
      // tslint:disable-next-line:no-console
      Logger.error(`Failed to connect to SurrealDB at url: ${url}, namespace: ${namespace}, database: ${database}: error: ${error instanceof Error ? error.message : JSON.stringify(error)}`, SurrealDbService.name);
      await this.db.close();
      // use false on c3-backend to prevent a crash o app boot, only throw and crash app if throwError is true
      if (throwError) {
        throw error;
      }
    }
  }

  // helper methods

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
    return await this.db.connect(url, opts || this.config);
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
