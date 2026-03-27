import { ADMIN_EMAIL, ADMIN_PASSWORD, APP_URL } from '../utils/constants';
import request from 'supertest';
import { RoleEnum } from '../../src/roles/roles.enum';
import { StatusEnum } from '../../src/statuses/statuses.enum';

describe('Ops Receipts MVP', () => {
  const owner1Email = 'john.doe@example.com';
  const driverEmail = 'driver@example.com';
  const defaultPassword = 'secret';

  let adminToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let driverToken: string;

  let harvestAreaId: string;
  let harvestAreaId2: string;
  let weighingStationId: string;

  beforeAll(async () => {
    const adminLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    adminToken = adminLogin.body.token;

    const owner1Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner1Email, password: defaultPassword });

    owner1Token = owner1Login.body.token;

    const driverLogin = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: driverEmail, password: defaultPassword });

    driverToken = driverLogin.body.token;

    // Admin creates 1 weighing station
    const weighingStationResp = await request(APP_URL)
      .post('/api/v1/weighing-stations')
      .auth(adminToken, { type: 'bearer' })
      .send({
        name: 'Tram Station A',
        code: 'TRM-001',
        latitude: 10.762622,
        longitude: 106.660172,
        formattedAddress: '123 Main St',
        unitPrice: 1200,
      });

    weighingStationId = weighingStationResp.body.id;

    // Owner1 creates 1 harvest area
    const harvestAreaResp = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        name: 'Harvest Area #1',
      });

    harvestAreaId = harvestAreaResp.body.id;

    // Admin creates Owner2
    const owner2Email = `owner2.${Date.now()}@example.com`;
    const owner2Pass = defaultPassword;
    const owner2UserResp = await request(APP_URL)
      .post('/api/v1/users')
      .auth(adminToken, { type: 'bearer' })
      .send({
        email: owner2Email,
        password: owner2Pass,
        firstName: 'Owner2',
        lastName: 'E2E',
        role: { id: RoleEnum.owner },
        status: { id: StatusEnum.active },
      })
      .expect(201);

    expect(owner2UserResp.body.id).toBeDefined();

    const owner2Login = await request(APP_URL)
      .post('/api/v1/auth/email/login')
      .send({ email: owner2Email, password: owner2Pass });

    owner2Token = owner2Login.body.token;

    // (Optional) create harvest area #2 for other checks later
    const harvestAreaResp2 = await request(APP_URL)
      .post('/api/v1/harvest-areas')
      .auth(owner1Token, { type: 'bearer' })
      .send({
        name: 'Harvest Area #2',
      });
    harvestAreaId2 = harvestAreaResp2.body.id;
  });

  it('should driver submit receipt, owner approves, driver cannot approve', async () => {
    const submitResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weighingStationId,
        weight: 12.5,
        amount: 15000,
        receiptDate: new Date().toISOString(),
        imageUrls: ['https://example.com/bill-phase2.jpg'],
      });

    expect(submitResp.status).toBe(201);
    expect(submitResp.body.status).toBe('pending');
    expect(submitResp.body.images?.length).toBe(1);
    expect(submitResp.body.images[0].isPrimary).toBe(true);
    const receiptId = submitResp.body.id;

    const approveResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(owner1Token, { type: 'bearer' })
      .send({});

    expect(approveResp.status).toBe(200);
    expect(approveResp.body.status).toBe('approved');
    expect(approveResp.body.financeRecord).toBeDefined();
    expect(approveResp.body.financeRecord.revenue).toBe('15000.00');

    const driverApproveResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(driverToken, { type: 'bearer' })
      .send();

    expect(driverApproveResp.status).toBe(403);
  });

  it('should owner only approve receipts for own harvest-area', async () => {
    const submitResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weighingStationId,
        weight: 10.1,
        amount: 12300,
        receiptDate: new Date().toISOString(),
        imageUrls: ['https://example.com/bill-owner2.jpg'],
      });

    const receiptId = submitResp.body.id;

    const owner2ApproveResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(owner2Token, { type: 'bearer' })
      .send();

    expect(owner2ApproveResp.status).toBe(403);
  });

  it('should pending receipt -> rejected -> cannot approve again', async () => {
    const submitResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId: harvestAreaId2,
        weighingStationId,
        weight: 20,
        amount: 24000,
        receiptDate: new Date().toISOString(),
        imageUrls: ['https://example.com/bill-reject.jpg'],
      });

    const receiptId = submitResp.body.id;

    const rejectResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/reject`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ rejectedReason: 'Rejected by owner for testing' });

    expect(rejectResp.status).toBe(200);
    expect(rejectResp.body.status).toBe('rejected');

    const approveAgainResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(owner1Token, { type: 'bearer' })
      .send();

    expect(approveAgainResp.status).toBe(422);
  });

  it('should reject approval without weighing station when not inferable', async () => {
    const submitResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weight: 5,
        amount: 5000,
        receiptDate: new Date().toISOString(),
        imageUrls: ['https://example.com/bill-no-station.jpg'],
      });

    expect(submitResp.status).toBe(201);
    const receiptId = submitResp.body.id;

    const approveResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(owner1Token, { type: 'bearer' })
      .send({});

    expect(approveResp.status).toBe(422);
    expect(approveResp.body.message?.error ?? approveResp.body.error).toBe(
      'weighingStationRequiredForApproval',
    );
  });

  it('should allow approval with weighingStationId in body when receipt has none', async () => {
    const submitResp = await request(APP_URL)
      .post('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .send({
        harvestAreaId,
        weight: 2,
        amount: 2000,
        receiptDate: new Date().toISOString(),
        imageUrls: ['https://example.com/bill-approve-body-station.jpg'],
      });

    expect(submitResp.status).toBe(201);
    const receiptId = submitResp.body.id;

    const approveResp = await request(APP_URL)
      .post(`/api/v1/receipts/${receiptId}/approve`)
      .auth(owner1Token, { type: 'bearer' })
      .send({ weighingStationId });

    expect(approveResp.status).toBe(200);
    expect(approveResp.body.financeRecord.revenue).toBe('2400.00');
  });

  it('should list receipts for driver, owner, and admin', async () => {
    const driverList = await request(APP_URL)
      .get('/api/v1/receipts')
      .auth(driverToken, { type: 'bearer' })
      .query({ limit: 50 });

    expect(driverList.status).toBe(200);
    expect(Array.isArray(driverList.body.data)).toBe(true);

    const ownerList = await request(APP_URL)
      .get('/api/v1/receipts')
      .auth(owner1Token, { type: 'bearer' })
      .query({ limit: 50 });

    expect(ownerList.status).toBe(200);

    const adminList = await request(APP_URL)
      .get('/api/v1/receipts')
      .auth(adminToken, { type: 'bearer' })
      .query({ limit: 50 });

    expect(adminList.status).toBe(200);
  });
});
