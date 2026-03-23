/**
 * Ensures global announcement routes are registered (regression: 404 Cannot PATCH).
 */
const request = require('supertest');

describe('Platform announcement routes', () => {
  let app;

  beforeAll(() => {
    // eslint-disable-next-line global-require
    app = require('../app');
  });

  it('PATCH /api/platform/announcement is registered (not 404)', async () => {
    const res = await request(app).patch('/api/platform/announcement').send({ enabled: false });
    expect(res.status).not.toBe(404);
  });

  it('PUT /api/platform/announcement is registered (not 404)', async () => {
    const res = await request(app).put('/api/platform/announcement').send({ enabled: false });
    expect(res.status).not.toBe(404);
  });
});
