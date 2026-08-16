import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, setSetting } from '../db/db';
import {
  createCustomer, createCase, updateCaseStatus, overridePriority, addCaseNote,
  computeDashboardMetrics, exportBackup, restoreBackup, validateBackup, sweepSla,
} from '../lib/repo';
import { DEFAULT_SLA_CONFIG } from '../lib/constants';

beforeEach(async () => {
  await db.customers.clear();
  await db.cases.clear();
  await db.agents.clear();
  await db.knowledgeArticles.clear();
  await db.notifications.clear();
  await db.auditEvents.clear();
  await db.settings.clear();
  await setSetting('slaConfig', DEFAULT_SLA_CONFIG);
});

describe('case creation pipeline', () => {
  it('rejects creating a second customer with an already-used email', async () => {
    await createCustomer({ name: 'Ayesha Khan', email: 'ayesha@example.com' });
    await expect(createCustomer({ name: 'Different Name', email: 'AYESHA@example.com' })).rejects.toThrow(/already exists/i);
  });

  it('rejects a case with missing required fields', async () => {
    await expect(createCase({ subject: '', description: '', customerId: null })).rejects.toThrow();
  });

  it('creates a customer and a fully analyzed case, and persists both', async () => {
    const customerId = await createCustomer({ name: 'Ayesha Khan', email: 'ayesha@example.com' });
    const caseId = await createCase({
      subject: 'Charged twice for my subscription',
      description: 'I was charged twice for my subscription and already contacted support yesterday about it.',
      customerId,
    });

    const saved = await db.cases.get(caseId);
    expect(saved.category).toBe('Billing');
    expect(saved.department).toBe('Billing');
    expect(saved.slaResolutionDeadline).toBeTruthy();
    expect(saved.customerId).toBe(customerId);

    const auditEvents = await db.auditEvents.where('targetId').equals(caseId).toArray();
    expect(auditEvents.some((e) => e.action.includes('created case'))).toBe(true);
    expect(auditEvents.some((e) => e.action.includes('intelligent analysis'))).toBe(true);
  });

  it('auto-assigns an agent from the routed department when one exists', async () => {
    await db.agents.add({ name: 'Billing Bob', department: 'Billing', role: 'Agent' });
    const customerId = await createCustomer({ name: 'Bilal', email: 'bilal@example.com' });
    const caseId = await createCase({ subject: 'Refund needed', description: 'I need a refund for my cancelled order please.', customerId });
    const saved = await db.cases.get(caseId);
    expect(saved.assignedAgentId).not.toBeNull();
    expect(saved.status).toBe('Assigned');
  });
});

describe('status transitions', () => {
  it('rejects an invalid transition', async () => {
    const customerId = await createCustomer({ name: 'Sana', email: 'sana@example.com' });
    const caseId = await createCase({ subject: 'Login broken', description: 'Cannot log in, getting an error every time I try.', customerId });
    await expect(updateCaseStatus(caseId, 'Closed')).rejects.toThrow();
  });

  it('records resolutionMins and clears stale SLA state on resolve', async () => {
    const customerId = await createCustomer({ name: 'Hamza', email: 'hamza@example.com' });
    const caseId = await createCase({ subject: 'App crashing', description: 'The app crashes every time I upload a file on my phone.', customerId });
    await db.cases.update(caseId, { status: 'In Progress', slaState: 'Breached' });
    await updateCaseStatus(caseId, 'Resolved');
    const saved = await db.cases.get(caseId);
    expect(saved.resolvedAt).toBeTruthy();
    expect(saved.resolutionMins).toBeGreaterThanOrEqual(0);
    expect(saved.slaState).toBe('Healthy');
  });
});

describe('priority override', () => {
  it('recomputes SLA deadlines when priority is overridden', async () => {
    const customerId = await createCustomer({ name: 'Mariam', email: 'mariam@example.com' });
    const caseId = await createCase({ subject: 'Question about plans', description: 'Just wondering about pricing, no rush.', customerId });
    const before = await db.cases.get(caseId);
    await overridePriority(caseId, 'Critical');
    const after = await db.cases.get(caseId);
    expect(after.priority).toBe('Critical');
    expect(new Date(after.slaResolutionDeadline).getTime()).not.toBe(new Date(before.slaResolutionDeadline).getTime());
  });
});

describe('knowledge base', () => {
  it('lists articles sorted newest-updated-first without requiring an index on updatedAt', async () => {
    // Regression test: this page previously called db.knowledgeArticles.orderBy('updatedAt'),
    // which throws because 'updatedAt' isn't part of the Dexie schema's indexed keyPaths.
    // listKnowledgeArticles() must sort client-side so it never depends on that index.
    const { listKnowledgeArticles } = await import('../lib/repo');
    await db.knowledgeArticles.bulkAdd([
      { title: 'Older', category: 'General', content: 'x', tags: [], status: 'Published', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { title: 'Newer', category: 'General', content: 'x', tags: [], status: 'Published', createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
    ]);
    const articles = await listKnowledgeArticles();
    expect(articles.length).toBe(2);
    expect(articles[0].title).toBe('Newer');
    expect(articles[1].title).toBe('Older');
  });
});

describe('internal notes', () => {
  it('appends a note without touching customer messages', async () => {
    const customerId = await createCustomer({ name: 'Usman', email: 'usman@example.com' });
    const caseId = await createCase({ subject: 'General enquiry', description: 'How does billing work here, just curious.', customerId });
    await addCaseNote(caseId, 'Called customer, left voicemail.', 'Agent Test');
    const saved = await db.cases.get(caseId);
    expect(saved.notes.length).toBe(1);
    expect(saved.messages.length).toBe(0);
  });
});

describe('dashboard metrics', () => {
  it('reflects created and resolved cases immediately', async () => {
    const customerId = await createCustomer({ name: 'Fatima', email: 'fatima@example.com' });
    const before = await computeDashboardMetrics();
    const caseId = await createCase({ subject: 'Delivery delayed', description: 'My order tracking has not updated in days.', customerId });
    const afterCreate = await computeDashboardMetrics();
    expect(afterCreate.totalCases).toBe(before.totalCases + 1);
    expect(afterCreate.openCases).toBe(before.openCases + 1);

    await db.cases.update(caseId, { status: 'In Progress' });
    await updateCaseStatus(caseId, 'Resolved');
    const afterResolve = await computeDashboardMetrics();
    expect(afterResolve.openCases).toBe(before.openCases);
    expect(afterResolve.resolvedToday).toBeGreaterThanOrEqual(1);
    expect(afterResolve.resolutionRate).toBeGreaterThan(0);
  });
});

describe('SLA sweep', () => {
  it('marks an overdue open case as Breached and logs it', async () => {
    const customerId = await createCustomer({ name: 'Zara', email: 'zara@example.com' });
    const caseId = await createCase({ subject: 'Urgent account issue', description: 'My account was suspended, please help immediately.', customerId });
    await db.cases.update(caseId, { slaResolutionDeadline: new Date(Date.now() - 1000).toISOString(), slaState: 'Healthy' });
    await sweepSla();
    const saved = await db.cases.get(caseId);
    expect(saved.slaState).toBe('Breached');
    const events = await db.auditEvents.where('targetId').equals(caseId).toArray();
    expect(events.some((e) => e.action.includes('SLA breached'))).toBe(true);
  });
});

describe('backup and restore', () => {
  it('round-trips all data through export/import', async () => {
    const customerId = await createCustomer({ name: 'Omar', email: 'omar@example.com' });
    const caseId = await createCase({ subject: 'Test case', description: 'Just testing the backup and restore workflow end to end.', customerId });

    const backup = await exportBackup();
    expect(backup.data.customers.length).toBeGreaterThan(0);
    expect(backup.data.cases.some((c) => c.id === caseId)).toBe(true);

    await db.cases.clear();
    await db.customers.clear();
    expect(await db.cases.count()).toBe(0);

    await restoreBackup(backup, { mode: 'replace' });
    expect(await db.cases.count()).toBe(backup.data.cases.length);
    expect(await db.customers.count()).toBe(backup.data.customers.length);
    const restored = await db.cases.get(caseId);
    expect(restored.subject).toBe('Test case');
  });

  it('rejects a malformed backup file and leaves existing data untouched', async () => {
    const customerId = await createCustomer({ name: 'Danish', email: 'danish@example.com' });
    await expect(restoreBackup({})).rejects.toThrow();
    await expect(restoreBackup(null)).rejects.toThrow();
    await expect(restoreBackup({ app: 'some-other-app', data: {} })).rejects.toThrow();
    // The failed restore attempts must not have touched existing data.
    expect(await db.customers.get(customerId)).toBeTruthy();
  });

  it('validateBackup flags structurally invalid files with a helpful message', () => {
    expect(validateBackup(null)).toMatch(/not a valid backup/i);
    expect(validateBackup({ app: 'customer-intellassist' })).toMatch(/missing/i);
    expect(validateBackup({ app: 'customer-intellassist', data: { customers: [], cases: [] } })).toBeNull();
  });
});

describe('CSV bulk import', () => {
  it('imports each valid row as a fully-analyzed case, reusing customers by email', async () => {
    const { importCasesFromCsv } = await import('../lib/repo');
    const validRows = [
      { rowNumber: 2, row: { customerName: 'Ayesha Khan', customerEmail: 'ayesha@example.com', subject: 'Charged twice', description: 'I was charged twice for my subscription this month, please refund the duplicate.' } },
      { rowNumber: 3, row: { customerName: 'Ayesha Khan', customerEmail: 'ayesha@example.com', subject: 'Still an issue', description: 'The duplicate charge from before is still showing on my account statement.' } },
    ];

    const result = await importCasesFromCsv(validRows, 'Test Importer');
    expect(result.created.length).toBe(2);
    expect(result.failed.length).toBe(0);

    // Both rows share an email — must resolve to the SAME customer record, not two.
    const customers = await db.customers.where('email').equalsIgnoreCase('ayesha@example.com').toArray();
    expect(customers.length).toBe(1);

    const firstCase = await db.cases.get(result.created[0]);
    expect(firstCase.category).toBe('Billing');
    expect(firstCase.analysis).toBeTruthy();
    expect(firstCase.customerId).toBe(customers[0].id);

    const events = await db.auditEvents.where('action').equals('imported cases from CSV').toArray();
    expect(events.length).toBe(1);
    expect(events[0].details).toMatch(/2 created/);
  });

  it('continues past a row that fails and reports it, without losing the successful rows', async () => {
    const { importCasesFromCsv } = await import('../lib/repo');
    const validRows = [
      { rowNumber: 2, row: { customerName: 'Fine Customer', customerEmail: 'fine@example.com', subject: 'Delivery delay', description: 'My package has not arrived and tracking shows no updates for days.' } },
      { rowNumber: 3, row: { customerName: '', customerEmail: 'bad', subject: '', description: '' } },
    ];
    const result = await importCasesFromCsv(validRows, 'Test Importer');
    expect(result.created.length).toBe(1);
    expect(result.failed.length).toBe(1);
    expect(result.failed[0].rowNumber).toBe(3);
  });
});
