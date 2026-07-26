/**
 * tests/unit/priceAlert.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/_lib/db', () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../api/_lib/adminAuth', () => ({
  requireAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('../../api/_lib/models/PriceAlert', () => {
  const m = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  };
  return { default: m };
});

vi.mock('../../api/_lib/analytics', () => ({ enqueueEvent: vi.fn() }));

import { evaluateAlerts } from '../../api/_lib/alertService';
import { handleAlerts } from '../../api/_lib/handlers/alerts';
import { enqueueEvent } from '../../api/_lib/analytics';
import PriceAlertModel from '../../api/_lib/models/PriceAlert';

const m = PriceAlertModel as any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<any> = {}): any {
  return {
    _id: 'alert_1',
    canonicalId: 'az_B0TEST',
    targetPrice: 999,
    currentPrice: 1499,
    sessionId: 'sess_test',
    productTitle: 'Test Kurta',
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

function makeReq(method: string, body: unknown = {}, query: Record<string, string> = {}): any {
  return { method, body, query, headers: {} };
}

function makeRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return res;
}

// ─── evaluateAlerts ───────────────────────────────────────────────────────────

describe('evaluateAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.find.mockResolvedValue([]);
    m.findOneAndUpdate.mockResolvedValue(null);
    m.updateMany.mockResolvedValue({});
  });

  it('returns early for invalid canonicalId', async () => {
    const result = await evaluateAlerts('', 999);
    expect(result).toEqual({ checked: 0, triggered: 0 });
    expect(m.find).not.toHaveBeenCalled();
  });

  it('returns early for latestPrice = 0', async () => {
    const result = await evaluateAlerts('az_B0TEST', 0);
    expect(result).toEqual({ checked: 0, triggered: 0 });
  });

  it('returns early for NaN latestPrice', async () => {
    const result = await evaluateAlerts('az_B0TEST', NaN);
    expect(result).toEqual({ checked: 0, triggered: 0 });
  });

  it('returns checked=0 when no active alerts exist', async () => {
    const result = await evaluateAlerts('az_B0TEST', 1200);
    expect(result).toEqual({ checked: 0, triggered: 0 });
  });

  it('does NOT trigger when latestPrice > targetPrice', async () => {
    m.find.mockResolvedValue([makeAlert({ targetPrice: 999 })]);
    const result = await evaluateAlerts('az_B0TEST', 1200);
    expect(result.triggered).toBe(0);
    expect(m.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does NOT trigger when latestPrice = targetPrice + 1', async () => {
    m.find.mockResolvedValue([makeAlert({ targetPrice: 999 })]);
    const result = await evaluateAlerts('az_B0TEST', 1000);
    expect(result.triggered).toBe(0);
  });

  it('triggers when latestPrice === targetPrice', async () => {
    const alert = makeAlert({ targetPrice: 999 });
    m.find.mockResolvedValue([alert]);
    m.findOneAndUpdate.mockResolvedValue({ ...alert, status: 'triggered' });
    const result = await evaluateAlerts('az_B0TEST', 999);
    expect(result.triggered).toBe(1);
    expect(m.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: alert._id, status: 'active' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'triggered' }) }),
      { new: true },
    );
  });

  it('triggers when latestPrice < targetPrice', async () => {
    const alert = makeAlert({ targetPrice: 999 });
    m.find.mockResolvedValue([alert]);
    m.findOneAndUpdate.mockResolvedValue({ ...alert, status: 'triggered' });
    const result = await evaluateAlerts('az_B0TEST', 799);
    expect(result.triggered).toBe(1);
  });

  it('enqueues alert_triggered analytics event on trigger', async () => {
    const alert = makeAlert({ targetPrice: 999 });
    m.find.mockResolvedValue([alert]);
    m.findOneAndUpdate.mockResolvedValue({ ...alert, status: 'triggered' });
    await evaluateAlerts('az_B0TEST', 799);
    expect(enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alert_triggered', canonicalId: 'az_B0TEST' })
    );
  });

  it('does NOT double-trigger when findOneAndUpdate returns null', async () => {
    const alert = makeAlert({ targetPrice: 999 });
    m.find.mockResolvedValue([alert]);
    m.findOneAndUpdate.mockResolvedValue(null);
    const result = await evaluateAlerts('az_B0TEST', 799);
    expect(result.triggered).toBe(0);
  });

  it('triggers only alerts at or below latestPrice', async () => {
    const alerts = [
      makeAlert({ _id: 'a1', targetPrice: 999 }),   // 1200 > 999 → no
      makeAlert({ _id: 'a2', targetPrice: 1500 }),  // 1200 <= 1500 → yes
      makeAlert({ _id: 'a3', targetPrice: 500 }),   // 1200 > 500 → no
    ];
    m.find.mockResolvedValue(alerts);
    m.findOneAndUpdate
      .mockResolvedValueOnce({ ...alerts[1], status: 'triggered' })
      .mockResolvedValue(null);
    const result = await evaluateAlerts('az_B0TEST', 1200);
    expect(result.checked).toBe(3);
    expect(result.triggered).toBe(1);
  });

  it('is non-fatal on DB error', async () => {
    m.find.mockRejectedValue(new Error('DB down'));
    await expect(evaluateAlerts('az_B0TEST', 999)).resolves.not.toThrow();
  });

  it('calls updateMany to set lastChecked when no triggers', async () => {
    m.find.mockResolvedValue([makeAlert({ targetPrice: 999 })]);
    await evaluateAlerts('az_B0TEST', 1200);
    expect(m.updateMany).toHaveBeenCalledWith(
      { canonicalId: 'az_B0TEST', status: 'active' },
      { $set: { lastChecked: expect.any(Date) } },
    );
  });
});

// ─── POST /alerts/create ──────────────────────────────────────────────────────

describe('handleAlerts — create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findOne.mockResolvedValue(null);
    m.create.mockResolvedValue(makeAlert());
    m.find.mockResolvedValue([]);
    m.updateMany.mockResolvedValue({});
  });

  it('returns 201 with created alert', async () => {
    const req = makeReq('POST', {
      canonicalId: 'az_B0TEST', targetPrice: 999, currentPrice: 1499,
      sessionId: 'sess1', productTitle: 'Test Kurta',
    });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alert: expect.any(Object) }));
  });

  it('returns 400 for missing sessionId', async () => {
    const req = makeReq('POST', { canonicalId: 'az_B0TEST', targetPrice: 999, currentPrice: 1499, productTitle: 'T' });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for missing canonicalId', async () => {
    const req = makeReq('POST', { sessionId: 'sess1', targetPrice: 999, currentPrice: 1499, productTitle: 'T' });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when targetPrice >= currentPrice', async () => {
    const req = makeReq('POST', {
      canonicalId: 'az_B0TEST', targetPrice: 1499, currentPrice: 1499,
      sessionId: 'sess1', productTitle: 'Test Kurta',
    });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when targetPrice is 0', async () => {
    const req = makeReq('POST', {
      canonicalId: 'az_B0TEST', targetPrice: 0, currentPrice: 1499,
      sessionId: 'sess1', productTitle: 'Test Kurta',
    });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 for duplicate active alert', async () => {
    m.findOne.mockResolvedValue(makeAlert());
    const req = makeReq('POST', {
      canonicalId: 'az_B0TEST', targetPrice: 999, currentPrice: 1499,
      sessionId: 'sess1', productTitle: 'Test Kurta',
    });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('enqueues alert_created analytics event', async () => {
    const req = makeReq('POST', {
      canonicalId: 'az_B0TEST', targetPrice: 999, currentPrice: 1499,
      sessionId: 'sess1', productTitle: 'Test Kurta',
    });
    const res = makeRes();
    await handleAlerts(req, res, 'create');
    expect(enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alert_created', canonicalId: 'az_B0TEST' })
    );
  });

  it('returns 405 for GET method', async () => {
    const res = makeRes();
    await handleAlerts(makeReq('GET'), res, 'create');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── GET /alerts/status ───────────────────────────────────────────────────────

describe('handleAlerts — status', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns alert when found', async () => {
    const alert = makeAlert();
    m.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(alert) }),
    });
    const req = makeReq('GET', {}, { canonicalId: 'az_B0TEST', sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'status');
    expect(res.json).toHaveBeenCalledWith({ alert: expect.objectContaining({ status: 'active' }) });
  });

  it('returns null when no alert found', async () => {
    m.findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    });
    const req = makeReq('GET', {}, { canonicalId: 'az_B0TEST', sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'status');
    expect(res.json).toHaveBeenCalledWith({ alert: null });
  });

  it('returns 400 when sessionId missing', async () => {
    const req = makeReq('GET', {}, { canonicalId: 'az_B0TEST' });
    const res = makeRes();
    await handleAlerts(req, res, 'status');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── POST /alerts/cancel ──────────────────────────────────────────────────────

describe('handleAlerts — cancel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cancels active alert and returns ok', async () => {
    m.findOneAndUpdate.mockResolvedValue(makeAlert({ status: 'cancelled' }));
    const req = makeReq('POST', { canonicalId: 'az_B0TEST', sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'cancel');
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('returns 404 when no active alert to cancel', async () => {
    m.findOneAndUpdate.mockResolvedValue(null);
    const req = makeReq('POST', { canonicalId: 'az_B0TEST', sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'cancel');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('enqueues alert_cancelled analytics event', async () => {
    m.findOneAndUpdate.mockResolvedValue(makeAlert({ status: 'cancelled' }));
    const req = makeReq('POST', { canonicalId: 'az_B0TEST', sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'cancel');
    expect(enqueueEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'alert_cancelled' })
    );
  });

  it('returns 400 when canonicalId missing', async () => {
    const req = makeReq('POST', { sessionId: 'sess1' });
    const res = makeRes();
    await handleAlerts(req, res, 'cancel');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── GET /alerts/dashboard ────────────────────────────────────────────────────

describe('handleAlerts — dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.aggregate.mockResolvedValue([]);
  });

  it('returns dashboard metrics shape', async () => {
    m.aggregate
      .mockResolvedValueOnce([{ _id: 'active', count: 5 }, { _id: 'triggered', count: 2 }])
      .mockResolvedValueOnce([{ _id: 'az_B0TEST', productTitle: 'Test Kurta', count: 3 }])
      .mockResolvedValueOnce([{ avg: 15.5 }]);
    const res = makeRes();
    await handleAlerts(makeReq('GET'), res, 'dashboard');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: expect.any(Number),
        active: expect.any(Number),
        triggered: expect.any(Number),
        conversionRate: expect.any(Number),
        avgTargetDiscount: expect.any(Number),
        topAlertedProducts: expect.any(Array),
      })
    );
  });

  it('returns 405 for POST', async () => {
    const res = makeRes();
    await handleAlerts(makeReq('POST'), res, 'dashboard');
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── Unknown subpath ──────────────────────────────────────────────────────────

describe('handleAlerts — unknown subpath', () => {
  it('returns 404', async () => {
    const res = makeRes();
    await handleAlerts(makeReq('GET'), res, 'unknown');
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── Performance ──────────────────────────────────────────────────────────────

describe('evaluateAlerts — performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findOneAndUpdate.mockResolvedValue(null);
    m.updateMany.mockResolvedValue({});
  });

  it('uses a single find() call for 100 alerts', async () => {
    const alerts = Array.from({ length: 100 }, (_, i) =>
      makeAlert({ _id: `a${i}`, targetPrice: 500 + i * 10 })
    );
    m.find.mockResolvedValue(alerts);
    const result = await evaluateAlerts('az_B0TEST', 1200);
    expect(m.find).toHaveBeenCalledTimes(1);
    expect(result.checked).toBe(100);
  });
});
