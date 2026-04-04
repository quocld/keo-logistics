import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';
import request from 'supertest';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Owner managed drivers', () => {
  const owner1Email = 'john.doe@example.com';
  const defaultPassword = 'secret';
  const suffix = Date.now();

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let driverId: number;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    adminToken = adminLogin.body.token;

    const owner1Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner1Email, password: defaultPassword });

    owner1Token = owner1Login.body.token;

    const owner2Email = `owner2.md.${suffix}@example.com`;
    await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner2Email,
        password: defaultPassword,
        firstName: 'O2',
        lastName: 'MD',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    const owner2Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner2Email, password: defaultPassword });

    owner2Token = owner2Login.body.token;
  });

  it('should let owner create and list managed drivers', async () => {
    const createResp = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        email: `managed.driver.${suffix}@example.com`,
        password: defaultPassword,
        firstName: 'Managed',
        lastName: 'Driver',
      })
      .expect(201);

    expect(createResp.body.role?.id).toBe(RoleEnum.driver);
    expect(createResp.body.managedByOwner?.id).toBeDefined();
    driverId = createResp.body.id;

    const listResp = await request(APP_URL)
      .get('/api/v1/owner/drivers')
      .auth(owner1Token, { type: 'bearer' })
      .query({ limit: 50 })
      .expect(200);

    const ids = listResp.body.data.map((u: { id: number }) => u.id);
    expect(ids).toContain(driverId);
  });

  it('should let owner get and update managed driver', async () => {
    const getResp = await request(APP_URL)
      .get(`/api/v1/owner/drivers/${driverId}`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(200);

    expect(getResp.body.id).toBe(driverId);

    const patchResp = await request(APP_URL)
      .patch(`/api/v1/owner/drivers/${driverId}`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ firstName: 'Updated' })
      .expect(200);

    expect(patchResp.body.firstName).toBe('Updated');
  });

  it('should forbid other owner from accessing managed driver', async () => {
    const getResp = await request(APP_URL)
      .get(`/api/v1/owner/drivers/${driverId}`)
      .auth(owner2Token, { type: 'bearer' });

    expect(getResp.status).toBe(403);
  });

  it('should let owner soft-delete managed driver', async () => {
    await request(APP_URL)
      .delete(`/api/v1/owner/drivers/${driverId}`)
      .auth(owner1Token, { type: 'bearer' })
      .expect(204);

    const getResp = await request(APP_URL)
      .get(`/api/v1/owner/drivers/${driverId}`)
      .auth(owner1Token, { type: 'bearer' });

    expect(getResp.status).toBe(403);
  });

  it('should let admin create driver with managedByOwnerId', async () => {
    const owner1Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner1Email, password: defaultPassword });

    const owner1Id = owner1Login.body.user.id;

    const createResp = await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: `admin.linked.driver.${suffix}@example.com`,
        password: defaultPassword,
        firstName: 'Linked',
        lastName: 'Driver',
        role: { id: RoleEnum.driver },
        status: { id: StatusEnum.active },
        managedByOwnerId: owner1Id,
      })
      .expect(201);

    expect(createResp.body.managedByOwner?.id).toBe(owner1Id);
  });
});
