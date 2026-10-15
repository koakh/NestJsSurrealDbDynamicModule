# AGENTS.md

This file contains guidelines and commands for agentic coding agents working in this repository.

---

## Build, Lint, and Test Commands

### Workspace Commands (Root)
```bash
yarn install --mode=skip-build          # Install dependencies (ALWAYS use --mode=skip-build)
yarn app-lib:dev                        # Run library in watch mode
yarn start:app-rst                      # Start REST consumer app
yarn surreal:docker                     # Start SurrealDB via Docker Compose
yarn surreal:docker:daemon              # Start SurrealDB in background
yarn surreal:initdb                      # Initialize database schema
yarn surreal:cli                        # Connect to SurrealDB CLI
```

### Package-Specific Commands

#### packages/app-lib (Main Library)
```bash
yarn dev                                # Watch mode for development
yarn build                              # Build TypeScript (tsc)
yarn lint                               # Run TSLint
yarn test                               # Run all tests
yarn test:watch                         # Run tests in watch mode
yarn test:cov                           # Generate coverage report
yarn test:e2e                           # End-to-end tests
```

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
yarn test:e2e                           # End-to-end tests
```

### Running a Single Test
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
- **Export Strategy**: Library exports both `SurrealDbService` and `SurrealDbController` (controller commented by default)

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
- Both packages use non-strict TypeScript (strict mode disabled)
- Compiler options: commonjs modules, es2017 target
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

### Connection Management
- **Health Checks**: Always call `checkConnectionAndTryReconnect()` before database operations
- **Auto-Reconnect**: Service automatically attempts reconnection on failure
- **Connection Options**: WebSocket URL with namespace, database, and auth credentials

```ts
async select<T>(thing: string) {
  await this.checkConnectionAndTryReconnect();
  return await this.db.select<T>(thing);
}
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
- Use `select()` to query records
- Use `update()` to replace entire record
- Use `merge()` to update partial fields
- Use `delete()` to remove records
- Use `query()` for custom SurrealQL

```ts
// Create
await this.surrealDbService.create('person', { name: 'John' });

// Select
const result = await this.surrealDbService.select('person:123');

// Update
await this.surrealDbService.update('person:123', { name: 'Jane' });

// Merge (partial update)
await this.surrealDbService.merge('person:123', { age: 30 });
```

### Authentication
- Use `signup()` for new user registration
- Use `signin()` for user authentication
- Use `authenticate()` with JWT token
- Use `invalidate()` to logout

```ts
const token = await this.surrealDbService.signup({
  namespace: 'test',
  database: 'test',
  access: 'user_access',
  variables: { email, password }
});
```

### Live Queries
- Use `live()` to subscribe to table changes
- Use `subscribeLive()` to add callbacks
- Use `unSubscribeLive()` to remove callbacks
- Use `kill()` to stop live queries

```ts
const uuid = await this.surrealDbService.live('person', (data) => {
  console.log('Live update:', data);
});
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
- ESLint for app-rst (TypeScript ESLint + Prettier)
- TSLint for app-lib
- Disabled rules: `interface-name-prefix`, `explicit-function-return-type`, `no-explicit-any`

### Global Pipes (main.ts)
- `ValidationPipe` enabled globally
- `transform: true` - auto-transform DTOs
- `whitelist: true` - strip non-whitelisted properties
- `forbidNonWhitelisted: true` - throw error for non-whitelisted properties

### Publishing Library
```bash
cd packages/app-lib
npm run build
npm run version:patch    # Bump version
npm run version:publish  # Publish to npm
```
