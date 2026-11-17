import { SurrealDbService, SurrealDbUser as User } from '@koakh/nestjs-surrealdb';
import { Body, ConflictException, Controller, Get, Logger, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { CreatePersonDto, DbSigninDto, DbSignupDto } from '../dto';

/**
 * showcase endpoints: each one exercises a `SurrealDbService` capability the way
 * a real consumer app would (auth flow, functions, nested-DTO CRUD, transactions,
 * live queries) — the raw SDK proxy lives in `SurrealDbController` instead
 */
@Controller('db')
export class DbController {
  constructor(
    private readonly surrealDbService: SurrealDbService,
  ) { }

  // use app-lib > calling userService
  @Get('user-service')
  async getUserFindOneByField(): Promise<User> {
    return this.surrealDbService.getUserFindOneByField();
  }

  @Get('select/:thing')
  select(@Param('thing') thing: string): any {
    return this.surrealDbService.select(thing);
  }

  // record access authentication (requires the initdb `account` access method)

  @Post('signup')
  async signup(@Body() signupDto: DbSignupDto) {
    const config = this.surrealDbService.getConfig();
    try {
      return await this.surrealDbService.signup({
        namespace: config.namespace,
        database: config.database,
        access: 'account',
        variables: { ...signupDto },
      });
    } catch (error) {
      // SurrealDB wraps record access clause failures opaquely ("The record access
      // signup query failed"), the most common cause being the unique idx_username
      const existing = await this.surrealDbService.query(
        'SELECT id FROM user WHERE username = $username',
        { username: signupDto.username },
      ).then((res) => (Array.isArray(res?.[0]) ? res[0].length > 0 : false)).catch(() => false);
      if (existing) {
        throw new ConflictException(`username '${signupDto.username}' is already taken (user.idx_username is UNIQUE)`);
      }
      throw error;
    }
  }

  @Post('signin')
  async signin(@Body() signinDto: DbSigninDto) {
    const config = this.surrealDbService.getConfig();
    try {
      return await this.surrealDbService.signin({
        namespace: config.namespace,
        database: config.database,
        access: 'account',
        variables: { ...signinDto },
      });
    } catch {
      // signin clause failures are equally opaque, don't leak which part failed
      throw new UnauthorizedException('invalid username or password');
    }
  }

  /**
   * the currently authenticated record user (`SELECT * FROM $auth`).
   * pass `?token=<access token from signup/signin>` to authenticate first,
   * otherwise the current session (root by default) is inspected
   */
  @Get('auth')
  async auth(@Query('token') token?: string) {
    if (token) {
      await this.surrealDbService.authenticate(token);
    }
    return (await this.surrealDbService.auth()) ?? { auth: 'no record user in session (root/system user)' };
  }

  /**
   * logout: invalidate the current session authentication, then restore the
   * root system session so subsequent demo endpoints keep working
   * (without the restore every later call would fail on anonymous permissions)
   */
  @Post('signout')
  async signout() {
    await this.surrealDbService.invalidate();
    const config = this.surrealDbService.getConfig();
    await this.surrealDbService.signin({ username: config.username, password: config.password });
    return { signedOut: true, rootSessionRestored: true };
  }

  // user-defined functions (initdb defines `fn::greet`)

  @Get('greet/:name')
  async greet(@Param('name') name: string) {
    // wrapped in an object so the endpoint always responds with JSON
    return { greeting: await this.surrealDbService.run<string>('fn::greet', [name]) };
  }

  // CRUD with a nested validated DTO

  @Post('person')
  async createPerson(@Body() createPersonDto: CreatePersonDto) {
    return await this.surrealDbService.create('person', createPersonDto);
  }

  @Get('person/:id')
  async getPerson(@Param('id') id: string) {
    return await this.surrealDbService.select(`person:${id}`);
  }

  // transactions: one endpoint doing begin -> query -> commit

  @Post('transaction-demo')
  async transactionDemo(@Body() createPersonDto: CreatePersonDto) {
    const tx = await this.surrealDbService.beginTransaction();
    try {
      const created = await tx.query(
        'CREATE person SET title = $title, name = $name, marketing = $marketing',
        { title: createPersonDto.title, name: createPersonDto.name, marketing: createPersonDto.marketing ?? false },
      );
      await tx.commit();
      return created;
    } catch (error) {
      await tx.cancel().catch(() => undefined);
      throw error;
    }
  }

  /**
   * live queries: starts a live query on the table, writes a record, captures
   * the live events for ~1.5s, kills the subscription and returns everything —
   * a self-contained live-query proof
   */
  @Post('live-demo/:thing')
  async liveDemo(@Param('thing') thing: string) {
    // v4 requires the table to exist before a live query can listen on it
    if (!thing.includes(':')) {
      await this.surrealDbService.query(`DEFINE TABLE IF NOT EXISTS ${thing} SCHEMALESS`);
    }
    const events: Array<Record<string, unknown>> = [];
    const subscription = await this.surrealDbService.live(thing);
    subscription.subscribe((event: any, legacyResult: any) => {
      // SDK >= 2.2.x passes a single event object `{ action, recordId, value }`,
      // older versions passed positional `(action, result)` — normalize both
      const normalized = event !== null && typeof event === 'object'
        ? { action: event.action, result: event.value ?? event.recordId ?? event }
        : { action: event, result: legacyResult };
      Logger.debug(`live event: ${JSON.stringify(normalized.action)}`, DbController.name);
      events.push(normalized);
    });
    const record = await this.surrealDbService.create(thing, { liveDemo: true, at: new Date().toISOString() });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await subscription.kill();
    return { events, record };
  }
}
