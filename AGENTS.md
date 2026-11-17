# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in this repository.

---

## Build, Lint, and Test Commands

### Workspace Commands (Root)
```bash
yarn install --mode=skip-build          # Install dependencies (ALWAYS use --mode=skip-build)
yarn app-lib:dev                        # Run library in watch mode
yarn app-lib:build                      # Build library (tsc)
yarn app-lib:surface                    # Lib surface test vs live SurrealDB (PASS/FAIL matrix)
yarn start:app-rst                      # Start REST consumer app
yarn surreal:install                    # Install SurrealDB v4 CLI (into ~/.local/bin)
yarn surreal:docker                     # Start SurrealDB via Docker Compose
yarn surreal                            # Start SurrealDB with local binary (rocksdb)
yarn surreal:initdb                      # Initialize database schema
yarn surreal:cli                        # Connect to SurrealDB CLI
yarn surreal:export                     # Export database as SurrealQL
yarn docker:app-rst:up                  # Start the whole docker stack (app + db)
yarn docker:app-rst:down                # Stop the docker stack
yarn app-lib:patch                      # Build + npm version patch
yarn app-lib:publish                    # Publish to npm
```

### Package-Specific Commands

#### packages/app-lib (Main Library)
```bash
yarn dev                                # Watch mode for development (tsc -w)
yarn build                              # Build TypeScript (tsc)
yarn lint                               # Run ESLint (flat config eslint.config.mjs, auto-fix)
yarn format                             # Format with Prettier
```

> NOTE: app-lib has no test suite — all tests (unit and e2e) live in app-rst

#### packages/app-rst (REST Consumer App)
```bash
yarn build                              # Build with NestJS CLI
yarn format                             # Format with Prettier
yarn start                              # Start application
yarn start:dev                         # Dev mode with debug and watch
yarn start:debug                        # Debug mode with nodemon
yarn lint                               # Run ESLint with auto-fix
yarn test                               # Run Jest tests
yarn test:watch                         # Watch tests
yarn test:cov                           # Coverage report
yarn test:e2e                           # End-to-end tests (needs a running SurrealDB)
```

### Running a Single Test

run from `packages/app-rst` (the only package with jest):

```bash
# Run a specific test file
yarn test path/to/file.spec.ts

# Run tests matching a pattern
yarn test --testNamePattern="test name"

# Run with debug
yarn test:debug path/to/file.spec.ts
```

---

## Architecture Overview

### Monorepo Structure
- **Yarn Workspaces**: Packages managed as workspaces with local dependency resolution
- **Main Library**: `packages/app-lib` - `@koakh/nestjs-surrealdb` (reusable NestJS module)
- **Consumer App**: `packages/app-rst` - REST API demo using the library
- **Local Dependencies**: Consumer apps use `workspace:^` for automatic linking to library changes

### Module Interaction Patterns
- **@Global() Decorator**: Used on `SurrealDbModule` to make it available globally without explicit imports
- **Async Configuration**: Modules use `forRootAsync()` with `useFactory()` for configuration injection
- **Provider Injection**: Custom providers use `@Inject(SYMBOL)` pattern for dependency resolution
- **Export Strategy**: Library exports both `SurrealDbService` and `SurrealDbController`; the controller is opt-in (the consumer adds it to its own `controllers` array)
- **Controller Security**: `SurrealDbControllerGuard` applies the opt-in `controllerGuard` module option to every controller endpoint (no guard configured = open)
- **Shutdown**: `SurrealDbService` implements `OnApplicationShutdown` and closes the connection; consumers must call `app.enableShutdownHooks()`

### Dependency Flow
```
packages/app-lib (@koakh/nestjs-surrealdb)
    ↓
packages/app-rst (imports via workspace:^)
    ↓
SurrealDb (external dependency)
```

---

## Code Style Guidelines

### TypeScript Configuration
- Both packages use non-strict TypeScript (strict-family checks disabled)
- Compiler options: commonjs modules, es2022 target
- Experimental decorators enabled
- Declaration: true for library (for publishing)
- Remove comments: true in builds

### Import Ordering
1. External dependencies (npm packages)
2. Internal workspace packages (@koakh/*)
3. Relative imports (../ or ./)
4. Each group separated by blank line

```ts
import { Injectable, Logger } from '@nestjs/common';
import { SurrealDbService } from '@koakh/nestjs-surrealdb';
import { DbService } from './db.service';
```

### Naming Conventions
- Classes/Interfaces: `PascalCase` - `SurrealDbService`, `DbModule`, `SignupDto`
- Methods/Properties: `camelCase` - `getDb`, `checkConnection`, `config`
- Constants/Enums: `UPPER_SNAKE_CASE` - `SURREALDB_MODULE_OPTIONS`
- Files: `kebab-case` - `surrealdb.service.ts`, `db.module.ts`
- Directories: `kebab-case` - `surrealdb/`, `db/`, `dto/`

### Formatting (.editorconfig + Prettier)
- Indentation: 2 spaces
- Line endings: LF
- Quotes: single quotes
- Trailing commas: all
- Max line length: 250 characters
- Trim trailing whitespace: disabled
- Insert final newline: disabled

### NestJS Patterns
- Services: `@Injectable()` decorator, constructor injection
- Modules: `@Module()` decorator with providers/exports/controllers
- Controllers: `@Controller('route')` decorator
- Global Modules: Use `@Global()` decorator when module needs global availability
- Async Config: Use `forRootAsync()` with `useFactory()` and `inject: []`

```ts
@Injectable()
export class DbService {
  constructor(
    private readonly surrealDbService: SurrealDbService,
  ) {}
}
```

### DTOs and Validation
- Use class-validator decorators for validation
- Use class-transformer for nested DTOs
- DTOs should use readonly properties
- Common validators: `@IsString()`, `@IsOptional()`, `@IsObject()`, `@IsNotEmpty()`

```ts
export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  readonly title: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PersonName)
  readonly name: PersonName;
}
```

### Error Handling
- Global exception filter: `AllExceptionsFilter` catches all exceptions
- Use NestJS HTTP exceptions (`HttpException`, `BadRequestException`)
- Use NestJS `Logger` for error logging
- Connection health checks before database operations
- Automatic reconnection logic in `SurrealDbService`

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    Logger.error(exception, AllExceptionsFilter.name);
    // Handle exception
  }
}
```

---

## Testing Patterns

### Unit Tests
- Use `Test.createTestingModule()` from `@nestjs/testing`
- Mock dependencies in providers array
- Service testing pattern:

```ts
describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find user by field', async () => {
    const result = await service.findOneByField('username', 'test');
    expect(result).toBeDefined();
    expect(result.username).toBe('test');
  });
});
```

### E2E Tests
- Located in `test/` directory
- Use `supertest` for HTTP requests
- Pattern:

```ts
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

### Test Configuration
- Jest with ts-jest transformer
- Test files: `*.spec.ts` in `src/`
- E2E config: `test/jest-e2e.json`
- Root directory for tests: `src`
- Test environment: node

---

## SurrealDB Specific Patterns

> v4 baseline (verified `4.0.0`): ISO GraphQL `gql()` is removed (server dropped it), `health()` probes via `version()` (server rpc removed), `relate()` runs SurrealQL `RELATE` with bindings (server rpc marshalling broken), `exportModel()`/SurrealML removed (feature capped `< 4.0.0`). session variables have a full set/get/unset trio (`get(variable)` runs `RETURN $<variable>`). the full surface is verified by `yarn app-lib:surface`.

### Connection Management
- **Health Checks**: Use `health()` (v2 replacement for v1 `ping`), plus `getStatus()` / `getIsConnected()`
- **Auto-Reconnect**: Handled by the SDK v2 `reconnect` ConnectOptions — enabled by default with unlimited attempts and exponential backoff; namespace/database/authentication are restored automatically on reconnect
- **Connection Options**: WebSocket URL with namespace, database, and auth credentials
- **Lifecycle Events**: Subscribe via `subscribe('connected' | 'reconnecting' | ...)`

```ts
// connect-time reconnect defaults applied by the module
reconnect: { enabled: true, attempts: -1, retryDelay: 1000, retryDelayMax: 30000, retryDelayMultiplier: 2 }
```

### Record ID Handling
- Record IDs can be strings or `RecordId` objects
- Helper method `recordIdFromStringThing()` converts string "table:id" to RecordId
- Helper method `thingExists()` validates record existence

```ts
async thingExists(thing: string): Promise<void> {
  if (thing.split(':').length === 2) {
    if (!await this.db.select(thing)) {
      throw new Error(`Record not found: ${thing}`);
    }
  }
}
```

### CRUD Operations
- Use `create()` to insert new records
- Use `select()` to query records (with optional `where`, `limit`, `start`, `fields`, `fetch` builder options)
- Use `update()` to update records, with `mode: 'content' | 'merge' | 'patch'` (default `content` REPLACES the record data)
- Use `upsert()` for create-or-update (same modes)
- Use `delete()` to remove records
- Use `query()` for custom SurrealQL

```ts
// Create
await this.surrealDbService.create('person', { name: 'John' });

// Select
const result = await this.surrealDbService.select('person:123');

// Update (replace)
await this.surrealDbService.update('person:123', { name: 'Jane' });

// Update (merge partial fields)
await this.surrealDbService.update('person:123', { age: 30 }, 'merge');
```

### Authentication
- Use `signup()` for new user registration (record access, requires `DEFINE ACCESS ... TYPE RECORD`)
- Use `signin()` for user authentication
- Use `authenticate()` with a token
- Use `invalidate()` to logout
- Both `signup()` and `signin()` return `Tokens { access, refresh? }` (not a bare token string)

```ts
const tokens = await this.surrealDbService.signup({
  namespace: 'test',
  database: 'test',
  access: 'account',
  variables: { username, password, marketing, tags }
});
```

### Live Queries
- Use `live()` to start a live query on a table (or record); it returns a subscription
- Subscribe via `subscription.subscribe((action, result) => ...)` or async-iterate the subscription
- Use `subscription.kill()` (or `kill(uuid)`) to stop live queries
- Use `liveOf(id)` to subscribe to an existing live query started elsewhere

```ts
const subscription = await this.surrealDbService.live('person');
subscription.subscribe((action, result) => {
  console.log('Live update:', action, result); // 'CREATE' | 'UPDATE' | 'DELETE'
});
// ...later
await subscription.kill();
```

### TypeScript Types
- Library provides wrapper types: `RecordId$1`, `SurrealDbUser`
- Generics for type-safe operations: `select<T>()`, `create<T, U>()`
- DTO validation handles type safety on input

---

## Additional Guidelines

### Code Comments
- Minimal inline comments (code should be self-documenting)
- JSDoc only for complex public methods
- Comments explain "why" not "what"
- Use TODO comments for future improvements

### Linting Rules
- ESLint for both packages (TypeScript ESLint + Prettier)
- app-lib uses ESLint 9 flat config (`eslint.config.mjs`)

### Global Pipes (main.ts)
- `ValidationPipe` enabled globally
- `transform: true` - auto-transform DTOs
- `whitelist: true` - strip non-whitelisted properties
- `forbidNonWhitelisted: true` - throw error for non-whitelisted properties
- `app.enableShutdownHooks()` - required for the lib's graceful connection close

### Security
- `GET /config` in app-rst redacts the password before returning the module config
- `ConnectDto.url` scheme allowlist blocks `file://` and arbitrary schemes
- unexpected errors return a generic 500 message (details stay in logs)
- expected `HttpException`s log as compact one-liners (stacks only for unexpected errors)
- process guard (app-rst main.ts): `unhandledRejection`/`uncaughtException` are logged and the app keeps running (default ON, `PROCESS_GUARD=false` restores crash-fast)
- HTTP status mappings on the proxy: missing record -> 404, duplicate record id -> 409, bad credentials -> 401, invalid/expired token -> 401, duplicate record-access signup -> 409 with causes

### Publishing Library
```bash
cd packages/app-lib
npm run build
npm run version:patch    # Bump version
npm run version:publish  # Publish to npm
```
