import { describe, it, expect } from 'vitest';
import { computeSlaDeadlines, computeSlaState, isValidSlaConfig } from '../lib/sla';
import { DEFAULT_SLA_CONFIG, PRIORITIES } from '../lib/constants';

describe('computeSlaDeadlines', () => {
  it('computes deadlines relative to createdAt using the priority config', () => {
    const created = new Date('2026-01-01T00:00:00.000Z').toISOString();
    const { firstResponseDeadline, resolutionDeadline } = computeSlaDeadlines('Critical', created, DEFAULT_SLA_CONFIG);
    expect(new Date(firstResponseDeadline).getTime() - new Date(created).getTime()).toBe(15 * 60000);
    expect(new Date(resolutionDeadline).getTime() - new Date(created).getTime()).toBe(120 * 60000);
  });
});

describe('computeSlaState', () => {
  it('is Healthy well before the deadline', () => {
    const created = Date.now() - 5 * 60000;
    const deadline = new Date(created + 120 * 60000).toISOString();
    expect(computeSlaState(deadline, { now: Date.now(), createdAt: new Date(created).toISOString() })).toBe('Healthy');
  });

  it('is At Risk within the risk threshold window', () => {
    const created = Date.now() - 110 * 60000;
    const deadline = new Date(created + 120 * 60000).toISOString(); // 10 mins left of a 120-min window = <20%
    expect(computeSlaState(deadline, { now: Date.now(), createdAt: new Date(created).toISOString() })).toBe('At Risk');
  });

  it('is Breached once the deadline has passed', () => {
    const deadline = new Date(Date.now() - 1000).toISOString();
    expect(computeSlaState(deadline, { now: Date.now(), createdAt: new Date(Date.now() - 200 * 60000).toISOString() })).toBe('Breached');
  });

  it('is always Healthy once resolved, even past the deadline', () => {
    const deadline = new Date(Date.now() - 100000).toISOString();
    expect(computeSlaState(deadline, { now: Date.now(), resolved: true })).toBe('Healthy');
  });
});

describe('isValidSlaConfig', () => {
  it('accepts a fully-populated, positive-integer config', () => {
    expect(isValidSlaConfig(DEFAULT_SLA_CONFIG, PRIORITIES)).toBe(true);
  });

  it('rejects a config with an empty/NaN field (e.g. a cleared input)', () => {
    const bad = { ...DEFAULT_SLA_CONFIG, Critical: { firstResponseMins: NaN, resolutionMins: 120 } };
    expect(isValidSlaConfig(bad, PRIORITIES)).toBe(false);
  });

  it('rejects zero or negative values', () => {
    const zero = { ...DEFAULT_SLA_CONFIG, High: { firstResponseMins: 0, resolutionMins: 480 } };
    const negative = { ...DEFAULT_SLA_CONFIG, Low: { firstResponseMins: 720, resolutionMins: -5 } };
    expect(isValidSlaConfig(zero, PRIORITIES)).toBe(false);
    expect(isValidSlaConfig(negative, PRIORITIES)).toBe(false);
  });

  it('rejects a config missing a priority entirely', () => {
    const { Critical, ...missing } = DEFAULT_SLA_CONFIG;
    void Critical;
    expect(isValidSlaConfig(missing, PRIORITIES)).toBe(false);
  });
});
