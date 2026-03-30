import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';
import request from 'supertest';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Ops Driver tracking (locations)', () => {
  const ownerEmail = 'john.doe@example.com';
  const defaultPassword = 'secret';
  const suffix = Date.now();

  let adminToken: string;
  let ownerToken: string;
  let driverToken: string;
  let driverId: number;

  let harvestAreaId: string;
  let weighingStationId: string;
  let tripId: string;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminLogin.body.token;

    const ownerLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ownerEmail, password: defaultPassword });
    ownerToken = ownerLogin.body.token;

    const createDriver = await request(APP_URL)
      .post('/api/v1/owner/drivers')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        email: `track.driver.${suffix}@example.com`,
        password: defaultPassword,
        firstName: 'Track',
        lastName: 'Driver',
      })
      .expect(201);
    driverId = createDriver.body.id;

    const driverLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: createDriver.body.email, password: defaultPassword });
    driverToken = driverLogin.body.token;

    const ha = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        name: `HA-${suffix}`,
        latitude: 10.111,
        longitude: 106.111,
        status: 'active',
      })
      .expect(201);
    harvestAreaId = ha.body.id;

    const ws = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(ownerToken, { type: 'bearer' })
      .send({
        name: `WS-${suffix}`,
        code: `TRM-TRACK-${suffix}`,
        latitude: 10.2,
        longitude: 106.2,
        formattedAddress: 'Addr',
        unitPrice: 1000,
      })
      .expect(201);
    weighingStationId = ws.body.id;

    // Assign driver to harvest area (needed by ops rules)
    await request(APP_URL)
      .put(`/api/v1/owner/drivers/${driverId}/harvest-areas`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ harvestAreaIds: [harvestAreaId] })
      .expect(204);

    const trip = await request(APP_URL)
      .post('/api/v1/trips')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weighingStationId,
        startNow: true,
      })
      .expect(201);
    tripId = trip.body.id;
  });

  it('should let driver POST /drivers/me/location and owner poll latest list', async () => {
    await request(APP_URL)
      .post('/api/v1/drivers/me/location')
      .auth(driverToken, { type: 'bearer' })
      .send({
        latitude: 10.12345678,
        longitude: 106.12345678,
        accuracy: 10,
        speed: 12.5,
      })
      .expect(204);

    const latest = await request(APP_URL)
      .get('/api/v1/owner/drivers/locations/latest')
      .auth(ownerToken, { type: 'bearer' })
      .query({ limit: 200 })
      .expect(200);

    const row = latest.body.data.find((r: any) => r.driverId === driverId);
    expect(row).toBeDefined();
    expect(row.location).toBeDefined();
    expect(row.location.latitude).toBeCloseTo(10.12345678, 6);
    expect(row.location.longitude).toBeCloseTo(106.12345678, 6);
  });

  it('should let driver POST /trips/:id/locations when trip in_progress', async () => {
    await request(APP_URL)
      .post(`/api/v1/trips/${tripId}/locations`)
      .auth(driverToken, { type: 'bearer' })
      .send({
        latitude: 10.3333,
        longitude: 106.4444,
        accuracy: 20,
        speed: 30,
      })
      .expect(204);
  });

  it('should not let owner2 see owner1 managed driver location', async () => {
    const owner2Email = `owner2.track.${suffix}@example.com`;
    await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner2Email,
        password: defaultPassword,
        firstName: 'O2',
        lastName: 'Track',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    const owner2Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner2Email, password: defaultPassword });
    const owner2Token = owner2Login.body.token;

    const latest = await request(APP_URL)
      .get('/api/v1/owner/drivers/locations/latest')
      .auth(owner2Token, { type: 'bearer' })
      .query({ limit: 200 })
      .expect(200);

    const ids = latest.body.data.map((r: any) => r.driverId);
    expect(ids).not.toContain(driverId);
  });
});
