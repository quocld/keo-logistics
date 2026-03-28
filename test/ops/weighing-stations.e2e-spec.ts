import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';
import request from 'supertest';
// import { RoleEnum } from '../../src/roles/roles.enum';
// import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Ops Weighing Stations (admin + owner)', () => {
  const owner1Email = 'john.doe@example.com';
  const defaultPassword = 'secret';
  const suffix = Date.now();

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;

  let adminStationId: string;
  let owner1StationId: string;
  let owner1UserId: number;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    adminToken = adminLogin.body.token;

    const owner1Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner1Email, password: defaultPassword });

    owner1Token = owner1Login.body.token;
    owner1UserId = owner1Login.body.user.id;

    const owner2Email = `owner2.ws.${suffix}@example.com`;
    // const owner2UserResp = await request(APP_URL)
    //   .post('/api/v1/users')
    //   .auth(adminToken, { type: 'bearer' })
    //   .send({
    //     email: owner2Email,
    //     password: defaultPassword,
    //     firstName: 'Owner2',
    //     lastName: 'WS',
    //     role: { id: RoleEnum.owner },
    //     status: { id: StatusEnum.active },
    //   })
    //   .expect(201);

    const owner2Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner2Email, password: defaultPassword });

    owner2Token = owner2Login.body.token;

    const adminStationResp = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: 'Admin station e2e',
        code: `TRM-ADM-${suffix}`,
        latitude: 10.1,
        longitude: 106.1,
        formattedAddress: 'Admin addr',
        unitPrice: 1000,
      })
      .expect(201);

    adminStationId = adminStationResp.body.id;

    const owner1StationResp = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        name: 'Owner1 station e2e',
        code: `TRM-O1-${suffix}`,
        latitude: 10.2,
        longitude: 106.2,
        formattedAddress: 'Owner1 addr',
        unitPrice: 1100,
      })
      .expect(201);

    owner1StationId = owner1StationResp.body.id;
  });

  it('should let owner list only own stations', async () => {
    const list = await request(APP_URL)
      .get('/api/v1/weighing-stations')
      .auth(owner1Token, { type: 'bearer' })
      .query({ limit: 50 })
      .expect(200);

    const ids = list.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(owner1StationId);
    expect(ids).not.toContain(adminStationId);
  });

  it('should forbid owner GET/PATCH on admin-owned (null owner) station', async () => {
    const getResp = await request(APP_URL)
      .get(`/api/v1/weighing-stations/${adminStationId}`)
      .auth(owner1Token, { type: 'bearer' });

    expect(getResp.status).toBe(403);

    const patchResp = await request(APP_URL)
      .patch(`/api/v1/weighing-stations/${adminStationId}`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ name: 'hijack' });

    expect(patchResp.status).toBe(403);
  });

  it('should forbid owner2 from mutating owner1 station', async () => {
    const patchResp = await request(APP_URL)
      .patch(`/api/v1/weighing-stations/${owner1StationId}`)
      .auth(owner2Token, { type: 'bearer' })
      .send({ name: 'not allowed' });

    expect(patchResp.status).toBe(403);
  });

  it('should let owner1 update own station', async () => {
    const patchResp = await request(APP_URL)
      .patch(`/api/v1/weighing-stations/${owner1StationId}`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ notes: 'updated by owner' })
      .expect(200);

    expect(patchResp.body.notes).toBe('updated by owner');
  });

  it('should let admin list all and filter by ownerId', async () => {
    const all = await request(APP_URL)
      .get('/api/v1/weighing-stations')
      .auth(adminToken, { type: 'bearer' })
      .query({ limit: 100 })
      .expect(200);

    const ids = all.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(adminStationId);
    expect(ids).toContain(owner1StationId);

    const filters = encodeURIComponent(
      JSON.stringify({ ownerId: owner1UserId }),
    );
    const filtered = await request(APP_URL)
      .get('/api/v1/weighing-stations')
      .auth(adminToken, { type: 'bearer' })
      .query({ limit: 100, filters })
      .expect(200);

    const fids = filtered.body.data.map((r: { id: string }) => r.id);
    expect(fids).toContain(owner1StationId);
    expect(fids).not.toContain(adminStationId);
  });

  it('should let owner1 soft-delete own station', async () => {
    const delSuffix = Date.now();
    const createResp = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        name: 'To delete',
        code: `TRM-DEL-${delSuffix}`,
        latitude: 10.3,
        longitude: 106.3,
        formattedAddress: 'Del addr',
        unitPrice: 900,
      })
      .expect(201);

    const id = createResp.body.id;

    await request(APP_URL)
      .delete(`/api/v1/weighing-stations/${id}`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(204);

    const getResp = await request(APP_URL)
      .get(`/api/v1/weighing-stations/${id}`)
      .auth(owner1Token, { type: 'bearer' });

    expect(getResp.status).toBe(404);
  });
});
