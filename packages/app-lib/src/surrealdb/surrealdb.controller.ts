import { All, Body, ConflictException, Controller, Delete, Get, Logger, Param, Patch, Post, Put, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  SurrealTransaction,
  Features,
} from 'surrealdb';
import { AuthenticateDto, ConnectDto, DataDto, QueryDto, RelateDto, SetDto, SigninDto, SignupDto, UnsetDto, UpdateDto, UseDto } from './dto';
import { SurrealDbControllerGuard } from './surrealdb.controller.guard';
import { SurrealDbService } from './surrealdb.service';

/**
 * registry of live subscriptions started over REST,
 * keyed by their live query uuid
 */
type LiveSubscriptionLike = {
  id?: { toString(): string };
  kill(): Promise<void>;
  isAlive: boolean;
  subscribe?: (callback: (action: unknown, result: unknown) => void) => unknown;
};

const liveCallback = (event, legacyResult) => {
  // SDK >= 2.2.x passes a single event object `{ action, recordId, value }`,
  // older versions passed positional `(action, result)` — normalize both
  const normalized = event !== null && typeof event === 'object' ? event : { action: event, result: legacyResult };
  if (normalized.action === 'CLOSE') return;
  Logger.log(`live action: ${JSON.stringify(normalized.action)}`, SurrealDbController.name);
};

/**
 * drop `undefined`-valued keys: transformed DTO instances declare every optional
 * property, and the SDK detects auth variants client-side with `in` checks
 * (ex `'variables' in auth'`), so a present-but-undefined key misroutes the call
 */
const compact = (o: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

@Controller('surrealdb')
@UseGuards(SurrealDbControllerGuard)
export class SurrealDbController {
  private readonly liveSubscriptions = new Map<string, LiveSubscriptionLike>();
  private readonly transactions = new Map<string, SurrealTransaction>();

  constructor(
    private readonly surrealDbService: SurrealDbService,
  ) { }

  // connection

  // note: whole-DTO params (no destructuring) are required for the global
  // ValidationPipe to see the metatype and actually validate the body

  @Post('/connect')
  async connect(@Body() connectDto: ConnectDto) {
    return await this.surrealDbService.connect(connectDto.url);
  }

  @Post('/close')
  async close() {
    return await this.surrealDbService.close();
  }

  @Get('/health')
  async health() {
    try {
      await this.surrealDbService.health();
      return { healthy: true };
    } catch (error) {
      // some engines/servers don't implement the health rpc, fall back to connection status
      return {
        healthy: this.surrealDbService.getIsConnected(),
        status: this.surrealDbService.getStatus(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Get('/status')
  status() {
    return {
      status: this.surrealDbService.getStatus(),
      isConnected: this.surrealDbService.getIsConnected(),
    };
  }

  @Get('/is-connected')
  isConnected() {
    return this.surrealDbService.getIsConnected();
  }

  @Get('/is-feature-supported/:feature')
  isFeatureSupported(@Param('feature') feature: string) {
    const features = Features as Record<string, unknown>;
    if (!(feature in features)) {
      throw new Error(`Unknown feature '${feature}'. Available: ${Object.keys(features).join(', ')}`);
    }
    return this.surrealDbService.isFeatureSupported(features[feature] as any);
  }

  @Get('/version')
  async version() {
    return await this.surrealDbService.version();
  }

  @Post('/use')
  async use(@Body() useDto: UseDto) {
    return await this.surrealDbService.use(useDto.namespace, useDto.database);
  }

  // events
  // note: the unsubscribe function is not kept over REST, this is mostly a debug helper

  @Post('/subscribe/:event')
  subscribe(@Param('event') event: string) {
    const unsubscribe = this.surrealDbService.subscribe(event, (...args) => {
      Logger.log(`event '${event}': ${JSON.stringify(args, undefined, 2)}`, SurrealDbController.name);
    });
    return { subscribed: true, event };
  }

  // sessions

  @Get('/sessions')
  async sessions() {
    return await this.surrealDbService.sessions();
  }

  @Post('/session')
  async newSession() {
    const session = await this.surrealDbService.newSession();
    return { session: session.session?.toString(), namespace: session.namespace, database: session.database };
  }

  @Post('/session/fork')
  async forkSession() {
    const session = await this.surrealDbService.forkSession();
    return { session: session.session?.toString(), namespace: session.namespace, database: session.database };
  }

  @Delete('/session')
  async closeSession() {
    return await this.surrealDbService.closeSession();
  }

  @Post('/reset')
  async reset() {
    return await this.surrealDbService.reset();
  }

  // import / export

  @Post('/import')
  async import(@Body() importDto: DataDto) {
    return await this.surrealDbService.import(importDto.data);
  }

  // https://surrealdb.com/docs/reference/javascript/api/core/surreal#export
  @Post('/export')
  async export(@Body() optionsDto?: any) {
    return await this.surrealDbService.export(optionsDto);
  }

  // transactions
  // begin returns an id, run queries with `/transaction/:id/query`, then commit or cancel

  @Post('/transaction')
  async beginTransaction() {
    const transaction = await this.surrealDbService.beginTransaction();
    const id = (transaction as any).transaction?.toString() ?? Math.random().toString(36).slice(2);
    this.transactions.set(id, transaction);
    return { id };
  }

  @Post('/transaction/:id/query')
  async transactionQuery(@Param('id') id: string, @Body() queryDto: QueryDto) {
    const transaction = this.getTransaction(id);
    return await transaction.query(queryDto.query, queryDto.bindings);
  }

  @Post('/transaction/:id/commit')
  async commitTransaction(@Param('id') id: string) {
    const transaction = this.getTransaction(id);
    this.transactions.delete(id);
    return await transaction.commit();
  }

  @Post('/transaction/:id/cancel')
  async cancelTransaction(@Param('id') id: string) {
    const transaction = this.getTransaction(id);
    this.transactions.delete(id);
    return await transaction.cancel();
  }

  private getTransaction(id: string): SurrealTransaction {
    const transaction = this.transactions.get(id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }
    return transaction;
  }

  // authentication

  // https://surrealdb.com/docs/reference/javascript/api/core/surreal-session#signup
  @Post('/signup')
  async signup(@Body() signupDto: SignupDto) {
    try {
      return await this.surrealDbService.signup(compact(signupDto) as any);
    } catch (error) {
      // SurrealDB 4 wraps record access clause failures opaquely, surface the common causes
      if (/signup query failed/i.test(error instanceof Error ? error.message : String(error))) {
        throw new ConflictException(
          `record access signup query failed (access '${signupDto.access}'): a UNIQUE field is already taken (ex username), or the variables are missing/invalid for the access clause`,
        );
      }
      throw error;
    }
  }

  // https://surrealdb.com/docs/reference/javascript/api/core/surreal-session#signin
  @Post('/signin')
  async signin(@Body() signinDto: SigninDto) {
    try {
      return await this.surrealDbService.signin(compact(signinDto) as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/problem with authentication|signin query failed/i.test(message)) {
        throw new UnauthorizedException('invalid credentials or access configuration');
      }
      throw error;
    }
  }

  @Post('/invalidate')
  async invalidate() {
    return await this.surrealDbService.invalidate();
  }

  @Post('/authenticate')
  async authenticate(@Body() authenticateDto: AuthenticateDto) {
    const token = authenticateDto.refresh
      ? { access: authenticateDto.token, refresh: authenticateDto.refresh }
      : authenticateDto.token;
    try {
      return await this.surrealDbService.authenticate(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/problem with authentication/i.test(message)) {
        throw new UnauthorizedException('token is invalid or expired');
      }
      throw error;
    }
  }

  // get the currently authenticated record user (v2 replacement for v1 `info`)
  @Get('/auth')
  async auth() {
    return await this.surrealDbService.auth();
  }

  // session configuration

  // v2 replacement for v1 `let`
  @Post('/set')
  async set(@Body() setDto: SetDto) {
    return await this.surrealDbService.set(setDto.variable, setDto.value);
  }

  @Post('/unset')
  async unset(@Body() unsetDto: UnsetDto) {
    return await this.surrealDbService.unset(unsetDto.variable);
  }

  // queries

  @Post('/query')
  async query(@Body() queryDto: QueryDto) {
    return await this.surrealDbService.query(queryDto.query, queryDto.bindings, queryDto.mode);
  }

  @Post('/run/:name')
  async run(@Param('name') name: string, @Body() runDto: unknown[]) {
    return await this.surrealDbService.run(name, runDto);
  }

  // surrealdb 3 user defined APIs, proxies GET/POST/PUT/PATCH/DELETE to `db.api()`

  @All('/api/*')
  async api(@Req() req: Request) {
    const prefix = '/surrealdb/api';
    const path = req.path.slice(req.path.indexOf(prefix) + prefix.length) || '/';
    const api = this.surrealDbService.api() as any;
    switch (req.method) {
      case 'POST':
        return await api.post(path, req.body);
      case 'PUT':
        return await api.put(path, req.body);
      case 'PATCH':
        return await api.patch(path, req.body);
      case 'DELETE':
        return await api.delete(path);
      default:
        return await api.get(path);
    }
  }

  // live queries

  @Post('/live/:thing')
  async live(@Param('thing') thing: string) {
    const subscription = await this.surrealDbService.live(thing);
    subscription.subscribe?.(liveCallback);
    const id = subscription.id?.toString();
    if (id) {
      this.liveSubscriptions.set(id, subscription);
    }
    return { id };
  }

  // v2 replacement for v1 `subscribe-live`
  @Post('/live-of/:id')
  async liveOf(@Param('id') id: string) {
    const subscription = await this.surrealDbService.liveOf(id);
    subscription.subscribe?.(liveCallback);
    const key = subscription.id?.toString() ?? id;
    this.liveSubscriptions.set(key, subscription);
    return { id: key };
  }

  // v2 replacement for v1 `kill`
  @Delete('/live/:id')
  async kill(@Param('id') id: string) {
    const subscription = this.liveSubscriptions.get(id);
    if (subscription) {
      this.liveSubscriptions.delete(id);
      return await subscription.kill();
    }
    // not started here, attach to it just to kill it
    const unmanaged = await this.surrealDbService.liveOf(id);
    return await unmanaged.kill();
  }

  // data methods

  @Get('/select/:thing')
  async select(
    @Param('thing') thing: string,
    @Query('where') where?: string,
    @Query('limit') limit?: string,
    @Query('start') start?: string,
    @Query('fields') fields?: string,
    @Query('fetch') fetch?: string,
  ) {
    return await this.surrealDbService.select(thing, {
      where,
      limit: limit !== undefined ? Number(limit) : undefined,
      start: start !== undefined ? Number(start) : undefined,
      fields: fields?.split(','),
      fetch: fetch?.split(','),
    });
  }

  @Post('/create/:thing')
  async create(@Param('thing') thing: string, @Body() createDto: DataDto) {
    return await this.surrealDbService.create(thing, createDto.data);
  }

  @Post('/insert/:thing')
  async insert(@Param('thing') thing: string, @Body() insertDto: DataDto) {
    return await this.surrealDbService.insert(thing, insertDto.data);
  }

  @Put('/update/:thing')
  async update(@Param('thing') thing: string, @Body() updateDto: UpdateDto) {
    return await this.surrealDbService.update(thing, updateDto.data, updateDto.mode);
  }

  @Patch('/upsert/:thing')
  async upsert(@Param('thing') thing: string, @Body() upsertDto: UpdateDto) {
    return await this.surrealDbService.upsert(thing, upsertDto.data, upsertDto.mode);
  }

  @Delete('/delete/:thing')
  async delete(@Param('thing') thing: string) {
    return await this.surrealDbService.delete(thing);
  }

  @Post('/relate/:thing')
  async relate(@Param('thing') thing: string, @Body() relateDto: RelateDto) {
    const from = relateDto.fromMany ?? relateDto.from;
    const to = relateDto.toMany ?? relateDto.to;
    return await this.surrealDbService.relate(from, thing, to, relateDto.data);
  }
}
