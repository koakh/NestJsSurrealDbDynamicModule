import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import {
  AccessRecordAuth,
  AnyAuth,
  ConnectionStatus,
  LiveResource,
  NamespaceDatabase,
  RecordId,
  StringRecordId,
  Surreal,
  SurrealSession,
  SurrealTransaction,
  Features,
  Table,
  Tokens,
  Uuid,
  VersionInfo,
  SqlExportOptions,
} from 'surrealdb';
import { UserServiceAbstract } from './surrealdb.abstracts';
import { SURREALDB_MODULE_OPTIONS, SURREALDB_MODULE_USER_SERVICE, adminCurrentUser } from './surrealdb.constants';
import { SurrealDbModuleOptions } from './surrealdb.interfaces';
import { RecordId$1, SurrealDbUser as User } from './types';

/**
 * how to return `query()` results
 * - `collect` (default): array of statement results
 * - `json`: JSON-compatible structures (loses SurrealDB type information)
 * - `responses`: full response objects (result, success, stats)
 * - `stream`: collected stream frames (query/batch chunks with stats)
 */
export type QueryMode = 'collect' | 'json' | 'responses' | 'stream';

/**
 * how `update()` / `upsert()` write data
 * - `content` (default): replace record data
 * - `merge`: merge record data
 * - `patch`: apply a JSON Patch array
 */
export type ContentMode = 'content' | 'merge' | 'patch';

export interface SelectOptions {
  where?: string;
  limit?: number;
  start?: number;
  fields?: string[];
  fetch?: string[];
}

@Injectable()
export class SurrealDbService implements OnApplicationShutdown {
  private db: Surreal;

  constructor(
    @Inject(SURREALDB_MODULE_OPTIONS)
    private readonly options: SurrealDbModuleOptions,
    @Inject(SURREALDB_MODULE_USER_SERVICE)
    private readonly userService: UserServiceAbstract,
  ) {
    if (!options.initSurrealDb || !options.initSurrealDb === false) {
      this.initSurrealDb(options.initSurrealDbThrowError);
    }
  }

  /**
   * graceful shutdown: close the connection when the app terminates
   * (requires `app.enableShutdownHooks()` in the consumer bootstrap)
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.db?.isConnected) {
      await this.db.close().catch((error) => {
        Logger.warn(`error closing SurrealDB connection on shutdown: ${error instanceof Error ? error.message : String(error)}`, SurrealDbService.name);
      });
    }
  }

  // SurrealDbModuleOptions
  getConfig(): SurrealDbModuleOptions {
    return this.options;
  }

  // userServiceAbstract: this is from consumer app AppModule/UserService
  getUserFindOneByField(): Promise<User> {
    return this.userService.findOneByField('username', 'admin', adminCurrentUser);
  }

  // initSurrealDb

  private async initSurrealDb(throwError: boolean = true): Promise<Surreal> {
    this.db = new Surreal();
    const { url, namespace, database, username, password, reconnect, retry, renewAccess, versionCheck } = this.options;
    try {
      // this appear on start of server log, after `[InstanceLoader] ConfigModule dependencies initialize`
      // Logger.log(`url: ${url}, namespace: ${namespace}, database: ${database}, username: ${username}, password: ${password}`, SurrealDbService.name);
      // subscribe to lifecycle events before connecting, else we miss the first `connected`
      this.subscribeConnectionEvents();
      await this.db.connect(url, {
        namespace,
        database,
        // surrealdb.js v2 renamed `auth` to `authentication`
        authentication: { username, password },
        // auto-reconnect with unlimited attempts and exponential backoff by default,
        // namespace/database/authentication are restored automatically on reconnect
        reconnect: reconnect ?? { enabled: true, attempts: -1, retryDelay: 1000, retryDelayMax: 30000, retryDelayMultiplier: 2 },
        ...(retry !== undefined ? { retry } : {}),
        ...(renewAccess !== undefined ? { renewAccess } : {}),
        ...(versionCheck !== undefined ? { versionCheck } : {}),
      });
      Logger.verbose(`surrealdb database is ready url: ${url}, namespace: ${namespace}, database: ${database}`, SurrealDbService.name);
      await this.db.ready;
      return this.db;
    } catch (error) {
      Logger.error(`Failed to connect to SurrealDB at url: ${url}, namespace: ${namespace}, database: ${database}: ${error instanceof Error ? error.message : String(error)}`, SurrealDbService.name);
      await this.db.close();
      // use false on c3-backend to prevent a crash o app boot
      if (throwError) {
        throw error;
      }
    }
  }

  /**
   * log connection lifecycle events at debug level
   * (`connecting`, `connected`, `reconnecting`, `disconnected`, `error`, `auth`, `using`)
   */
  private subscribeConnectionEvents(): void {
    this.db.subscribe('connecting', () => Logger.debug(`event: connecting`, SurrealDbService.name));
    this.db.subscribe('connected', (version) => Logger.debug(`event: connected (${version})`, SurrealDbService.name));
    this.db.subscribe('reconnecting', () => Logger.debug(`event: reconnecting`, SurrealDbService.name));
    this.db.subscribe('disconnected', () => Logger.debug(`event: disconnected`, SurrealDbService.name));
    this.db.subscribe('error', (error) => Logger.debug(`event: error: ${error instanceof Error ? error.message : String(error)}`, SurrealDbService.name));
    this.db.subscribe('auth', (tokens) => Logger.debug(`event: auth: ${tokens ? 'authenticated' : 'invalidated'}`, SurrealDbService.name));
    this.db.subscribe('using', (using) => Logger.debug(`event: using: ${using?.namespace}/${using?.database}`, SurrealDbService.name));
  }

  // helper methods

  /**
   * check if thing is a record id, ex `table:id`
   */
  isRecordId(thing: string): boolean {
    return thing.split(':').length === 2;
  }

  /**
   * parse a string into a surrealdb.js v2 value class:
   * - `table:id` -> `StringRecordId`
   * - `table` -> `Table` (v2 no longer accepts plain strings as table names)
   */
  parseThing(thing: string): Table | StringRecordId {
    return this.isRecordId(thing) ? new StringRecordId(thing) : new Table(thing);
  }

  /**
   * check if thing exists if passed id with entity, else does nothing
   * @param thing
   */
  async thingExists(thing: string): Promise<void> {
    if (this.isRecordId(thing)) {
      if (!await this.db.select(new StringRecordId(thing))) {
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

  // connection methods

  /**
   * Establish a connection to the database
   * @param url - The endpoint to connect to
   * @param opts - Connection options
   */
  async connect(
    url: string | URL,
    opts?: {
      namespace?: string;
      database?: string;
      authentication?: ConnectAuth;
      reconnect?: ReconnectOptions;
      retry?: ReconnectOptions;
      renewAccess?: boolean;
      versionCheck?: boolean;
    },
  ): Promise<true> {
    return await this.db.connect(url, opts || {
      namespace: this.options.namespace,
      database: this.options.database,
      authentication: { username: this.options.username, password: this.options.password },
    });
  }

  /**
   * Disconnect from the database
   */
  async close(): Promise<true> {
    return await this.db.close();
  }

  /**
   * Check the health of the connected SurrealDB instance
   * (v2 replacement for v1 `ping`)
   *
   * note: SurrealDB 4 removed the `health` rpc method, so this probes the
   * server with a `version()` round-trip instead (throws when unreachable)
   */
  async health(): Promise<void> {
    if (!this.db.isConnected) {
      throw new Error(`not connected (status: ${this.db.status})`);
    }
    await this.db.version();
  }

  /**
   * Retrieves the version of the connected SurrealDB instance
   * @example { version: "surrealdb-3.1.6" }
   */
  async version(): Promise<VersionInfo> {
    return await this.db.version();
  }

  /**
   * Returns the current connection status
   */
  getStatus(): ConnectionStatus {
    return this.db.status;
  }

  /**
   * Returns whether the connection is currently established
   */
  getIsConnected(): boolean {
    return this.db.isConnected;
  }

  /**
   * Checks whether a feature is available in the current connection
   * @example isFeatureSupported(Features.LiveQueries)
   */
  isFeatureSupported(feature: (typeof Features)[keyof typeof Features]): boolean {
    return this.db.isFeatureSupported(feature);
  }

  /**
   * Subscribe to connection/session events
   * (`connecting`, `connected`, `reconnecting`, `disconnected`, `error`, `auth`, `using`)
   * @returns an unsubscribe function
   */
  subscribe(event: string, listener: (...args: any[]) => void): () => void {
    return (this.db as any).subscribe(event, listener);
  }

  // session methods

  /**
   * Create a fresh new isolated session on this connection.
   * A session has its own namespace, database, variables and authentication state.
   */
  async newSession(): Promise<SurrealSession> {
    return await this.db.newSession();
  }

  /**
   * Create a new session by cloning the current session
   * (namespace, database, variables and authentication state are inherited)
   */
  async forkSession(): Promise<SurrealSession> {
    return await this.db.forkSession();
  }

  /**
   * List all sessions created on the current connection
   */
  async sessions(): Promise<Uuid[]> {
    return await this.db.sessions();
  }

  /**
   * Stop the primary session. Equivalent to calling `close()` on the connection
   */
  async closeSession(): Promise<void> {
    return await this.db.closeSession();
  }

  /**
   * Reset the current session to its initial state, clearing
   * authentication state, variables, and selected namespace/database
   */
  async reset(): Promise<void> {
    return await (this.db as any).reset();
  }

  // import / export methods

  /**
   * Import an existing export (SurrealQL) into the database
   *
   * SurrealDB 3.x requires `OPTION IMPORT;` as the first statement of an import
   * (disables events, live queries and field processing for performance),
   * it is prepended automatically when not present
   * @param input - The SurrealQL to import
   */
  async import(input: string): Promise<unknown> {
    const sql = /^\s*OPTION IMPORT;/m.test(input) ? input : `OPTION IMPORT;\n${input}`;
    return await this.db.import(sql);
  }

  /**
   * Export the database as SurrealQL and return the result as a string
   * @param options - Export configuration options
   */
  async export(options?: Partial<SqlExportOptions>): Promise<string> {
    return await this.db.export(options);
  }

  // transactions

  /**
   * Create a new transaction scoped to the current session.
   * Run queries on it, then `commit()` to apply or `cancel()` to discard
   */
  async beginTransaction(): Promise<SurrealTransaction> {
    return await this.db.beginTransaction();
  }

  // authentication methods

  /**
   * Signs up to a record access method
   * @param vars - Variables used in a signup query
   * @return The authentication tokens (access and refresh)
   */
  async signup(vars: AccessRecordAuth): Promise<Tokens> {
    return await this.db.signup(vars);
  }

  /**
   * Signs in with system user or record access credentials
   * @param vars - Variables used in a signin query
   * @return The authentication tokens (access and refresh)
   */
  async signin(vars: AnyAuth): Promise<Tokens> {
    return await this.db.signin(vars);
  }

  /**
   * Authenticates the session with an access token or tokens pair
   * @param token - The JWT access token, or a tokens object `{ access, refresh? }`
   */
  async authenticate(token: string | Tokens): Promise<unknown> {
    return await this.db.authenticate(token as any);
  }

  /**
   * Invalidates the authentication for the current session
   */
  async invalidate(): Promise<void> {
    return await this.db.invalidate();
  }

  /**
   * Get the currently authenticated record user (`SELECT * FROM $auth`)
   * (v2 replacement for v1 `info`)
   */
  async auth<T extends Record<string, unknown>>(): Promise<T | undefined> {
    return await this.db.auth<T>() as T | undefined;
  }

  /**
   * Create a `SurrealApi` instance for invoking SurrealDB 3 user-defined
   * API endpoints (`api.get('/users')`, `api.post(path, body)`, ...)
   * @param prefix - Optional path prefix prepended to all calls
   */
  api(prefix?: string): unknown {
    return this.db.api(prefix);
  }

  // session configuration methods

  /**
   * Switch to a specific namespace and database
   * @param namespace - Switches to a specific namespace
   * @param database - Switches to a specific database
   */
  async use(namespace?: string, database?: string): Promise<NamespaceDatabase> {
    return await this.db.use({ namespace, database });
  }

  /**
   * Specify a variable for the current session
   * (v2 replacement for v1 `let`)
   * @param variable - Specifies the name of the variable
   * @param value - Assigns the value to the variable name
   */
  async set(variable: string, value: any): Promise<void> {
    return await this.db.set(variable, value);
  }

  /**
   * Read a session variable back (the SDK has `set`/`unset` but no getter,
   * this runs `RETURN $<variable>` under the hood)
   * @param variable - Specifies the name of the variable (without the `$`)
   */
  async get<T = unknown>(variable: string): Promise<T | null> {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable)) {
      throw new Error(`invalid variable name: ${variable}`);
    }
    const res = await this.query<T[]>(`RETURN $${variable}`);
    // collect mode wraps the single statement result, RETURN of NONE gives null
    return (Array.isArray(res) ? res[0] : res) ?? null;
  }

  /**
   * Remove a variable from the current session
   * @param variable - Specifies the name of the variable
   */
  async unset(variable: string): Promise<void> {
    return await this.db.unset(variable);
  }

  // query methods

  /**
   * Runs a set of SurrealQL statements against the database
   * @param query - Specifies the SurrealQL statements
   * @param bindings - Assigns variables which can be used in the query
   * @param mode - How to return results: `collect` (default), `json`, `responses` or `stream`
   */
  async query<T extends unknown[]>(query: string, bindings?: Record<string, unknown>, mode: QueryMode = 'collect'): Promise<T | unknown> {
    const q = this.db.query<T>(query, bindings);
    switch (mode) {
      case 'json':
        return await q.json();
      case 'responses':
        return await q.responses();
      case 'stream': {
        const frames: unknown[] = [];
        for await (const frame of q.stream()) {
          frames.push(frame);
        }
        return frames;
      }
      default:
        return await q;
    }
  }

  /**
   * Run a SurrealQL function
   * @param name - The full name of the function
   * @param args - The arguments supplied to the function. You can also supply a version here as a string, in which case the third argument becomes the parameter list.
   */
  async run<T>(name: string, args?: unknown[]): Promise<T>;
  /**
   * Run a SurrealML model
   * @param name - The full name of the function
   * @param version - The version of the function. If omitted, the second argument is the parameter list
   * @param args - The arguments supplied to the function
   */
  async run<T>(name: string, version: string, args?: unknown[]): Promise<T>;
  // Implementation
  async run<T>(name: string, versionOrArgs?: string | unknown[], args?: unknown[]): Promise<T> {
    // Handle the arguments based on their types
    // note: never pass an explicit `undefined` version, it breaks the SDK overload dispatch
    if (Array.isArray(versionOrArgs)) {
      // Called as run(name, args)
      return await this.db.run<T>(name, versionOrArgs);
    } else {
      // Called as run(name, version, args)
      return await this.db.run<T>(name, versionOrArgs as string, args);
    }
  }

  // data methods

  /**
   * Selects all records in a table, or a specific record, from the database,
   * with optional query builder options (`where`, `limit`, `start`, `fields`, `fetch`)
   * @param thing - The table name or a record ID (`table` or `table:id`) to select
   * @param opts - Optional builder options
   */
  async select<T extends { [x: string]: unknown; }>(thing: string, opts?: SelectOptions): Promise<T | T[]> {
    let p: any = this.db.select<T>(this.parseThing(thing) as any);
    if (opts?.where !== undefined) p = p.where(opts.where);
    if (opts?.limit !== undefined) p = p.limit(opts.limit);
    if (opts?.start !== undefined) p = p.start(opts.start);
    if (opts?.fields?.length) p = p.fields(...opts.fields);
    if (opts?.fetch?.length) p = p.fetch(...opts.fetch);
    if (this.isRecordId(thing)) {
      await this.thingExists(thing);
    }
    return await p;
  }

  /**
   * Creates a record in the database
   * @param thing - The table name or the specific record ID (`table` or `table:id`) to create
   * @param data - The document / record data to create
   */
  async create<T extends { [x: string]: unknown; }>(thing: string, data?: any): Promise<T | T[]> {
    return await this.db.create<T>(this.parseThing(thing) as any).content(data) as unknown as T | T[];
  }

  /**
   * Inserts one or multiple records in the database
   * @param thing - The table name to insert into
   * @param data - The document(s) / record(s) to insert
   */
  async insert<T extends { [x: string]: unknown; }>(thing: string, data?: any): Promise<T[]> {
    return await this.db.insert<T>(new Table(thing), data) as unknown as T[];
  }

  /**
   * Updates all records in a table, or a specific record, in the database.
   *
   * ***NOTE: by default (`content`) this replaces the current document / record data with the specified data,
   * use `mode: 'merge'` or `mode: 'patch'` to change the behavior***
   * @param thing - The table name or the specific record ID (`table` or `table:id`) to update
   * @param data - The document / record data
   * @param mode - `content` (default, replace), `merge` or `patch` (JSON Patch array)
   */
  async update<T extends { [x: string]: unknown; }>(thing: string, data?: any, mode: ContentMode = 'content'): Promise<T | T[]> {
    if (this.isRecordId(thing)) {
      await this.thingExists(thing);
    }
    const p: any = this.db.update<T>(this.parseThing(thing) as any);
    return await (mode === 'merge' ? p.merge(data) : mode === 'patch' ? p.patch(data) : p.content(data));
  }

  /**
   * Upserts all records in a table, or a specific record, in the database.
   *
   * ***NOTE: by default (`content`) this replaces the current document / record data with the specified data,
   * use `mode: 'merge'` or `mode: 'patch'` to change the behavior***
   * @param thing - The table name or the specific record ID (`table` or `table:id`) to upsert
   * @param data - The document / record data
   * @param mode - `content` (default, replace), `merge` or `patch` (JSON Patch array)
   */
  async upsert<T extends { [x: string]: unknown; }>(thing: string, data?: any, mode: ContentMode = 'content'): Promise<T | T[]> {
    // note: no thingExists check here, upsert is create-or-update by design
    const p: any = this.db.upsert<T>(this.parseThing(thing) as any);
    return await (mode === 'merge' ? p.merge(data) : mode === 'patch' ? p.patch(data) : p.content(data));
  }

  /**
   * Deletes all records in a table, or a specific record, from the database.
   * @param thing - The table name or a record ID (`table` or `table:id`) to select
   */
  async delete<T extends { [x: string]: unknown; }>(thing: string): Promise<T | T[]> {
    if (this.isRecordId(thing)) {
      await this.thingExists(thing);
    }
    return await this.db.delete<T>(this.parseThing(thing) as any) as unknown as T | T[];
  }

  /**
   * Create graph relationships (edges) between records.
   * Supports single or fan-out (`from`/`to` arrays) relations
   *
   * note: SurrealDB 4 broke the `relate` rpc argument marshalling
   * (`Cannot execute RELATE statement where property 'out' is: ...`),
   * so this runs a SurrealQL `RELATE` with bindings instead
   * @param from - The source record(s)
   * @param thing - The edge table name
   * @param to - The target record(s)
   * @param data - Optional data to store on the edge record
   */
  async relate<T extends { [x: string]: unknown; }>(
    from: string | string[],
    thing: string,
    to: string | string[],
    data?: any,
  ): Promise<T | T[]> {
    const fromIds = Array.isArray(from) ? from.map((f) => new StringRecordId(f)) : new StringRecordId(from);
    const toIds = Array.isArray(to) ? to.map((t) => new StringRecordId(t)) : new StringRecordId(to);
    // identifiers can't be query bindings, quote the edge table name unless it's a plain identifier
    const edge = /^[A-Za-z_][A-Za-z0-9_]*$/.test(thing) ? thing : `\`${thing.replace(/`/g, '``')}\``;
    const hasData = data !== undefined;
    const q = hasData ? `RELATE $from->${edge}->$to CONTENT $data` : `RELATE $from->${edge}->$to`;
    const res = await this.query<any>(q, { from: fromIds, to: toIds, ...(hasData ? { data } : {}) });
    // query() collects one result array per statement, RELATE is a single statement
    return (Array.isArray(res) ? res[0] : res) as T | T[];
  }

  // live query methods

  /**
   * Start a live select query and return the subscription.
   *
   * the awaited subscription exposes:
   * - `id` (Uuid) to use with `liveOf` / `kill`
   * - `subscribe(callback)` to receive updates (`CREATE`, `UPDATE`, `DELETE`)
   * - async iteration `for await (const message of subscription)`
   * - `kill()` to stop it
   * - `isAlive`
   *
   * @param thing - The table or record ID to receive live results for
   */
  async live<T = Record<string, unknown>>(thing: string): Promise<any> {
    return await this.db.live<T>(this.parseThing(thing) as LiveResource);
  }

  /**
   * Subscribe to an existing live select query by its id
   * (v2 replacement for v1 `subscribeLive`)
   * @param id - The unique ID of an existing live query
   */
  async liveOf<T = Record<string, unknown>>(id: Uuid | string): Promise<any> {
    const uuid = typeof id === 'string' ? new Uuid(id) : id;
    return await this.db.liveOf(uuid) as any;
  }
}

// keep local loose types for `connect` passthrough (avoids exporting SDK internals in the public signature)
type ConnectAuth = AnyAuth | { username: string; password: string } | string | (() => any);
type ReconnectOptions = { enabled?: boolean; attempts?: number; retryDelay?: number; retryDelayMax?: number; retryDelayMultiplier?: number; retryDelayJitter?: number };
