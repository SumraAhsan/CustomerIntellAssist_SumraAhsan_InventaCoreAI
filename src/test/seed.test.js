import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { createCustomer } from '../lib/repo';
import { hasAnyData, hasSampleData, loadSampleData, clearSampleData } from '../lib/seed';

beforeEach(async () => {
  await db.customers.clear();
  await db.cases.clear();
  await db.agents.clear();
  await db.knowledgeArticles.clear();
  await db.notifications.clear();
  await db.auditEvents.clear();
  await db.settings.clear();
});

describe('sample data', () => {
  it('reports an empty workspace correctly before anything is loaded', async () => {
    expect(await hasAnyData()).toBe(false);
    expect(await hasSampleData()).toBe(false);
  });

  it('loads a realistic, clearly-tagged sample dataset into an empty workspace', async () => {
    await loadSampleData('Test Admin');
    expect(await hasAnyData()).toBe(true);
    expect(await hasSampleData()).toBe(true);

    const customers = await db.customers.toArray();
    const cases = await db.cases.toArray();
    const agents = await db.agents.toArray();
    const articles = await db.knowledgeArticles.toArray();

    expect(customers.length).toBeGreaterThan(0);
    expect(cases.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
    expect(articles.length).toBeGreaterThan(0);
    expect(customers.every((c) => c.sample === true)).toBe(true);
    expect(cases.every((c) => c.sample === true)).toBe(true);

    const events = await db.auditEvents.toArray();
    expect(events.some((e) => e.action.includes('loaded sample data'))).toBe(true);
  });

  it('refuses to load sample data into a workspace that already has data', async () => {
    await createCustomer({ name: 'Real Customer', email: 'real@example.com' });
    await expect(loadSampleData('Test Admin')).rejects.toThrow(/already has customers/i);
  });

  it('clears only sample-tagged records, leaving user-created data untouched', async () => {
    await loadSampleData('Test Admin');
    const realCustomerId = await createCustomer({ name: 'Real Customer', email: 'real@example.com' });

    await clearSampleData('Test Admin');

    expect(await hasSampleData()).toBe(false);
    const remainingCustomers = await db.customers.toArray();
    expect(remainingCustomers.length).toBe(1);
    expect(remainingCustomers[0].id).toBe(realCustomerId);

    const remainingCases = await db.cases.toArray();
    expect(remainingCases.length).toBe(0);

    const remainingAgents = await db.agents.toArray();
    const remainingArticles = await db.knowledgeArticles.toArray();
    expect(remainingAgents.length).toBe(0);
    expect(remainingArticles.length).toBe(0);
  });

  it('never double-seeds when two loads race concurrently', async () => {
    // Regression test: loadSampleData() used to check "is this workspace
    // empty?" and then insert in a separate, un-atomic sequence, so two
    // near-simultaneous calls (e.g. a double click) could both pass the
    // check and seed data twice. The whole operation is now one Dexie
    // transaction, so this must never happen.
    const results = await Promise.allSettled([
      loadSampleData('Caller A'),
      loadSampleData('Caller B'),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const customers = await db.customers.toArray();
    expect(customers.length).toBe(38);
  });
});
