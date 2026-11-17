import { Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
// supertest v7 is esm-first: a namespace import is not callable under ts-jest CJS
// without esModuleInterop, so require it directly with the typed shape
const request = require('supertest') as typeof import('supertest');
import { SurrealDbController, SurrealDbModule } from '@koakh/nestjs-surrealdb';
import { Surreal } from 'surrealdb';
import { AppModule } from '../src/app.module';

/**
 * DB-backed e2e: boots the full AppModule (with SurrealDbController) against a
 * live SurrealDB server and exercises the demo surface end-to-end.
 *
 * requires a running SurrealDB v4 with the initdb schema imported
 * (`yarn surreal:docker` + `yarn surreal:initdb`, or any v4 endpoint), override via:
 *
 *   SURREALDB_URL=ws://192.168.1.103:9001/rpc SURREALDB_PASSWORD=... yarn test:e2e
 *
 * when the server is unreachable the DB specs log a warning and pass as skipped
 */

// point at the default local stack unless overridden (process.env wins over .env)
process.env.SURREALDB_URL ??= 'ws://127.0.0.1:8001/rpc';
process.env.SURREALDB_NAMESPACE ??= 'test';
process.env.SURREALDB_DATABASE ??= 'test';
process.env.SURREALDB_USERNAME ??= 'root';
process.env.SURREALDB_PASSWORD ??= 'root';

const dbUrl = process.env.SURREALDB_URL!;
const NS = process.env.SURREALDB_NAMESPACE!;
const DB = process.env.SURREALDB_DATABASE!;
const USER = process.env.SURREALDB_USERNAME!;
const PASS = process.env.SURREALDB_PASSWORD!;

async function dbReachable(url: string): Promise<boolean> {
  try {
    const db = new Surreal();
    await db.connect(url, { namespace: NS, database: DB });
    await db.close();
    return true;
  } catch {
    return false;
  }
}

// the same global pipe configuration as src/main.ts, so specs see real validation
function applyAppConfig(app: INestApplication): INestApplication {
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  return app;
}

async function waitForConnect(app: INestApplication): Promise<void> {
  const { SurrealDbService } = await import('@koakh/nestjs-surrealdb');
  const svc = app.get(SurrealDbService);
  const deadline = Date.now() + 15000;
  while (!svc.getIsConnected()) {
    if (Date.now() > deadline) throw new Error(`timeout waiting for the surrealdb connection (${dbUrl})`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('App (e2e, needs a running SurrealDB)', () => {
  let app: INestApplication;
  let reachable = false;

  beforeAll(async () => {
    reachable = await dbReachable(dbUrl);
    if (!reachable) {
      console.warn(`\n[surrealdb e2e] no server reachable at ${dbUrl} — DB specs run as skipped\n`);
    }
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = applyAppConfig(moduleFixture.createNestApplication());
    await app.init();
    if (reachable) {
      await waitForConnect(app);
    }
  });

  afterAll(async () => {
    if (!app) return;
    if (reachable) {
      // cleanup demo data (root session restored by the auth spec)
      await request(app.getHttpServer())
        .post('/surrealdb/query')
        .send({ query: "DELETE person WHERE title IN ['developer', 'tx-person']; DELETE user WHERE string::starts_with(username, 'e2e_'); DELETE live_e2e;" })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('GET / returns hello', async () => {
    if (!reachable) return;
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        if (!res.body?.message?.includes('Hello')) throw new Error(`unexpected: ${JSON.stringify(res.body)}`);
      });
  });

  it('GET /config redacts the password', async () => {
    if (!reachable) return;
    await request(app.getHttpServer())
      .get('/config')
      .expect(200)
      .expect((res) => {
        if (res.body.password !== '***') throw new Error(`password not redacted: ${JSON.stringify(res.body.password)}`);
      });
  });

  it('GET /surrealdb/health and /version', async () => {
    if (!reachable) return;
    await request(app.getHttpServer()).get('/surrealdb/health').expect(200).expect({ healthy: true });
    await request(app.getHttpServer())
      .get('/surrealdb/version')
      .expect(200)
      .expect((res) => {
        if (!String(res.body?.version ?? '').startsWith('surrealdb-')) throw new Error(`unexpected: ${JSON.stringify(res.body)}`);
      });
  });

  it('POST /db/person creates, GET /db/person/:id reads back', async () => {
    if (!reachable) return;
    const created = await request(app.getHttpServer())
      .post('/db/person')
      .send({ title: 'developer', name: { first: 'Ee', last: 'Twoe' }, marketing: true })
      .expect(201)
      .then((res) => res.body);
    const row = Array.isArray(created) ? created[0] : created;
    const id = String(row?.id ?? '').replace('person:', '');
    if (!id) throw new Error(`no id: ${JSON.stringify(created)}`);
    await request(app.getHttpServer())
      .get(`/db/person/${id}`)
      .expect(200)
      .expect((res) => {
        if (res.body?.name?.first !== 'Ee') throw new Error(`unexpected: ${JSON.stringify(res.body)}`);
      });
  });

  it('POST /db/person with invalid nested DTO returns 400', async () => {
    if (!reachable) return;
    await request(app.getHttpServer())
      .post('/db/person')
      .send({ title: 'x', name: { first: '' }, hacker: true })
      .expect(400);
  });

  it('GET /db/greet/:name runs fn::greet', async () => {
    if (!reachable) return;
    await request(app.getHttpServer())
      .get('/db/greet/e2e')
      .expect(200)
      .expect((res) => {
        if (res.body?.greeting !== 'Hello, e2e!') throw new Error(`unexpected: ${JSON.stringify(res.body)}`);
      });
  });

  it('POST /db/transaction-demo commits atomically', async () => {
    if (!reachable) return;
    const res = await request(app.getHttpServer())
      .post('/db/transaction-demo')
      .send({ title: 'tx-person', name: { first: 'Trans', last: 'Action' } })
      .expect(201);
    if (!Array.isArray(res.body) || !String(res.body?.[0]?.[0]?.id ?? '').startsWith('person:')) {
      throw new Error(`unexpected: ${JSON.stringify(res.body).slice(0, 120)}`);
    }
  });

  it('POST /db/live-demo/:thing captures the CREATE event', async () => {
    if (!reachable) return;
    const res = await request(app.getHttpServer())
      .post('/db/live-demo/live_e2e')
      .expect(201);
    const actions = (res.body?.events ?? []).map((e: any) => String(e.action));
    if (!actions.includes('CREATE')) throw new Error(`no CREATE event captured: ${JSON.stringify(res.body).slice(0, 150)}`);
  });

  it('HTTP status mappings: 404 / 409 / 401', async () => {
    if (!reachable) return;
    // missing record -> 404
    await request(app.getHttpServer()).get('/surrealdb/select/person:definitely_missing_audit').expect(404);
    // duplicate record id -> 409 (create fresh first, then duplicate)
    await request(app.getHttpServer()).post('/surrealdb/create/person:audit409').send({ data: { title: 'audit' } }).expect(201);
    await request(app.getHttpServer()).post('/surrealdb/create/person:audit409').send({ data: { title: 'audit' } }).expect(409)
      .expect((res) => {
        if (!String(res.body?.message ?? '').includes('already exists')) throw new Error(`unexpected: ${JSON.stringify(res.body)}`);
      });
    // bad credentials -> 401
    await request(app.getHttpServer()).post('/db/signin').send({ username: 'ghost', password: 'nope' }).expect(401);
    // invalid/expired token -> 401
    await request(app.getHttpServer()).post('/surrealdb/authenticate').send({ token: 'garbage.token.here' }).expect(401);
    // cleanup
    await request(app.getHttpServer()).delete('/surrealdb/delete/person:audit409').expect(200);
  });

  it('record access auth flow: signup -> signin -> auth, then restore root', async () => {
    if (!reachable) return;
    const username = `e2e_auth_${Date.now()}`;
    const signup = await request(app.getHttpServer())
      .post('/db/signup')
      .send({ username, password: 'Passw0rd!', marketing: true, tags: ['e2e'] })
      .expect(201)
      .then((res) => res.body);
    if (!signup?.access) throw new Error(`no tokens: ${JSON.stringify(signup).slice(0, 80)}`);

    const signin = await request(app.getHttpServer())
      .post('/db/signin')
      .send({ username, password: 'Passw0rd!' })
      .expect(201)
      .then((res) => res.body);
    if (!signin?.access) throw new Error('signin returned no tokens');

    await request(app.getHttpServer())
      .get(`/db/auth?token=${signin.access}`)
      .expect(200)
      .expect((res) => {
        const id = String(res.body?.id ?? '');
        if (!id.startsWith('user:')) throw new Error(`unexpected auth: ${JSON.stringify(res.body).slice(0, 120)}`);
      });

    // restore the root session for the afterAll cleanup
    await request(app.getHttpServer())
      .post('/surrealdb/signin')
      .send({ username: USER, password: PASS })
      .expect(201);
  });
});

describe('controllerGuard (e2e)', () => {
  it('rejects without the key and allows with it', async () => {
    const reachable = await dbReachable(dbUrl);
    const HostModule = class GuardHostModule {};
    Module({
      imports: [
        SurrealDbModule.forRoot({
          url: dbUrl,
          namespace: NS,
          database: DB,
          username: USER,
          password: PASS,
          // don't crash the boot when the DB is offline, the 403 paths still work
          initSurrealDbThrowError: false,
          controllerGuard: (request: any) => request.headers['x-api-key'] === 'e2e-secret',
        }),
      ],
      controllers: [SurrealDbController],
    })(HostModule);

    const moduleFixture = await Test.createTestingModule({ imports: [HostModule] }).compile();
    const guardApp = applyAppConfig(moduleFixture.createNestApplication());
    await guardApp.init();
    if (reachable) {
      await waitForConnect(guardApp);
    }

    const server = guardApp.getHttpServer();
    await request(server).get('/surrealdb/health').expect(403);
    await request(server).get('/surrealdb/health').set('x-api-key', 'wrong').expect(403);
    if (reachable) {
      await request(server).get('/surrealdb/health').set('x-api-key', 'e2e-secret').expect(200).expect({ healthy: true });
    }
    await guardApp.close();
  });
});
