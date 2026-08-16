import Dexie from 'dexie';

export const db = new Dexie('customer_intellassist');

// Single local workspace — everything lives in this one browser's IndexedDB.
// Embedded arrays (messages, notes) live on the case record itself, trading
// normalization for simplicity in a local-first app.
db.version(1).stores({
  customers: '++id, name, email, accountStatus, createdAt',
  cases: '++id, customerId, category, status, priority, department, assignedAgentId, createdAt, slaState',
  agents: '++id, name, department, role',
  knowledgeArticles: '++id, title, category, status, createdAt',
  notifications: '++id, createdAt, read, relatedCaseId',
  auditEvents: '++id, timestamp, action, targetType, targetId',
  settings: 'key',
});

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}
