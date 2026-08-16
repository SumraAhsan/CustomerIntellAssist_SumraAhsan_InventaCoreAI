// Service layer — the UI never touches Dexie directly. This is the seam
// that would let a real backend replace IndexedDB later without a UI rewrite.
import { db, getSetting, setSetting } from '../db/db';
import { analyzeCase } from './intelligence';
import { computeSlaDeadlines, computeSlaState } from './sla';
import { DEFAULT_SLA_CONFIG, STATUS_TRANSITIONS } from './constants';

// ---------- Audit & notifications ----------

export async function logAudit(actor, action, targetType, targetId, details = '') {
  return db.auditEvents.add({
    timestamp: new Date().toISOString(),
    actor, action, targetType, targetId, details,
  });
}

export async function notify(message, { type = 'info', relatedCaseId = null } = {}) {
  return db.notifications.add({
    createdAt: new Date().toISOString(), message, type, read: false, relatedCaseId,
  });
}

// ---------- Customers ----------

export async function createCustomer(data, actor = 'Workspace') {
  const email = (data.email || '').trim();
  const existing = await db.customers.where('email').equalsIgnoreCase(email).first();
  if (existing) {
    throw new Error(`A customer with this email already exists (${existing.name}) — use the existing record instead of creating a duplicate.`);
  }

  const now = new Date().toISOString();
  const id = await db.customers.add({
    name: data.name,
    email,
    phone: data.phone || '',
    accountStatus: data.accountStatus || 'Active',
    createdAt: now,
    lastContact: now,
    satisfaction: data.satisfaction ?? null,
    tags: data.tags || [],
    notes: data.notes || '',
  });
  await logAudit(actor, 'created customer', 'customer', id, data.name);
  return id;
}

/**
 * Finds an existing customer by email (case-insensitive), or creates one.
 * Unlike createCustomer(), this never throws on a duplicate — it's meant
 * for bulk import, where the same customer legitimately appears across
 * multiple rows and should be reused, not rejected.
 */
export async function findOrCreateCustomerByEmail(data, actor = 'Workspace') {
  const email = (data.email || '').trim();
  const existing = await db.customers.where('email').equalsIgnoreCase(email).first();
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const id = await db.customers.add({
    name: data.name,
    email,
    phone: data.phone || '',
    accountStatus: 'Active',
    createdAt: now,
    lastContact: now,
    satisfaction: null,
    tags: [],
    notes: '',
  });
  await logAudit(actor, 'created customer', 'customer', id, data.name);
  return id;
}

// ---------- Cases (the core workflow) ----------

export async function createCase({ subject, description, customerId, actor = 'Workspace' }) {
  if (!subject?.trim() || !description?.trim() || !customerId) {
    throw new Error('Subject, description, and customer are required to create a case.');
  }

  const existingCases = await db.cases.toArray();
  const slaConfig = (await getSetting('slaConfig')) || DEFAULT_SLA_CONFIG;
  const now = new Date().toISOString();

  // The local intelligence engine should never be able to block case creation.
  // If it throws for any reason, fall back to safe defaults so the workflow continues.
  let analysis;
  let usedFallback = false;
  try {
    analysis = analyzeCase(subject, description, existingCases, customerId);
  } catch {
    usedFallback = true;
    analysis = {
      category: { category: 'General', confidence: 0, reasons: ['Automated analysis failed — defaulted to General.'] },
      sentiment: { sentiment: 'neutral', confidence: 0, reasons: ['Automated analysis failed — defaulted to neutral.'] },
      priority: { priority: 'Medium', confidence: 0, reasons: ['Automated analysis failed — defaulted to Medium.'] },
      department: 'General Support', missingInfo: [], related: [], analyzedAt: now,
    };
  }
  const deadlines = computeSlaDeadlines(analysis.priority.priority, now, slaConfig);

  const caseId = await db.cases.add({
    customerId,
    subject: subject.trim(),
    description: description.trim(),
    category: analysis.category.category,
    subcategory: null,
    priority: analysis.priority.priority,
    status: 'Open',
    sentiment: analysis.sentiment.sentiment,
    urgency: analysis.sentiment.sentiment === 'urgent' ? 'High' : 'Normal',
    department: analysis.department,
    assignedAgentId: null,
    createdAt: now,
    updatedAt: now,
    slaFirstResponseDeadline: deadlines.firstResponseDeadline,
    slaResolutionDeadline: deadlines.resolutionDeadline,
    slaState: 'Healthy',
    resolvedAt: null,
    resolutionMins: null,
    tags: [],
    relatedCaseIds: analysis.related.map((r) => r.id),
    missingInfo: analysis.missingInfo,
    analysis,
    messages: [],
    notes: [],
  });

  await db.customers.update(customerId, { lastContact: now });
  await logAudit(actor, 'created case', 'case', caseId, subject);
  if (usedFallback) {
    await logAudit('System', 'intelligent analysis unavailable — used rule-based fallback', 'case', caseId);
  } else {
    await logAudit('System', 'intelligent analysis completed', 'case', caseId,
      `Category: ${analysis.category.category} (${Math.round(analysis.category.confidence * 100)}%), Priority: ${analysis.priority.priority}, Sentiment: ${analysis.sentiment.sentiment}`);
  }

  const agentId = await assignBestAgent(analysis.department);
  if (agentId) {
    await db.cases.update(caseId, { assignedAgentId: agentId, status: 'Assigned' });
    const agent = await db.agents.get(agentId);
    await logAudit('System', 'auto-assigned', 'case', caseId, `Routed to ${analysis.department} → ${agent?.name}`);
    await notify(`Case #${caseId} assigned to ${agent?.name}.`, { relatedCaseId: caseId });
  }

  if (analysis.priority.priority === 'Critical' || analysis.priority.priority === 'High') {
    await notify(`New ${analysis.priority.priority} priority case #${caseId}: ${subject}`, { type: 'warn', relatedCaseId: caseId });
  }

  return caseId;
}

export async function assignBestAgent(department) {
  const agents = await db.agents.where('department').equals(department).toArray();
  if (!agents.length) return null;
  const openCases = await db.cases.where('status').noneOf(['Resolved', 'Closed']).toArray();
  const loadByAgent = {};
  for (const c of openCases) {
    if (c.assignedAgentId) loadByAgent[c.assignedAgentId] = (loadByAgent[c.assignedAgentId] || 0) + 1;
  }
  agents.sort((a, b) => (loadByAgent[a.id] || 0) - (loadByAgent[b.id] || 0));
  return agents[0].id;
}

export async function updateCaseStatus(caseId, newStatus, actor = 'Agent') {
  const c = await db.cases.get(caseId);
  if (!c) throw new Error('Case not found.');
  const allowed = STATUS_TRANSITIONS[c.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move a case from "${c.status}" to "${newStatus}".`);
  }
  const patch = { status: newStatus, updatedAt: new Date().toISOString() };
  if (newStatus === 'Resolved') {
    patch.resolvedAt = new Date().toISOString();
    patch.resolutionMins = Math.round((new Date(patch.resolvedAt) - new Date(c.createdAt)) / 60000);
    // Once resolved, the SLA clock stops — don't let list views keep showing a stale Breached/At Risk badge.
    patch.slaState = 'Healthy';
  } else if (c.status === 'Resolved' && newStatus === 'In Progress') {
    patch.resolvedAt = null;
    patch.resolutionMins = null;
  }
  await db.cases.update(caseId, patch);
  await logAudit(actor, `status changed ${c.status} → ${newStatus}`, 'case', caseId);
  if (newStatus === 'Resolved') {
    await notify(`Case #${caseId} was resolved.`, { type: 'success', relatedCaseId: caseId });
  }
  return true;
}

export async function overridePriority(caseId, newPriority, actor = 'Agent') {
  const c = await db.cases.get(caseId);
  const slaConfig = (await getSetting('slaConfig')) || DEFAULT_SLA_CONFIG;
  const deadlines = computeSlaDeadlines(newPriority, c.createdAt, slaConfig);
  await db.cases.update(caseId, {
    priority: newPriority,
    slaFirstResponseDeadline: deadlines.firstResponseDeadline,
    slaResolutionDeadline: deadlines.resolutionDeadline,
    updatedAt: new Date().toISOString(),
  });
  await logAudit(actor, `priority overridden ${c.priority} → ${newPriority}`, 'case', caseId);
}

export async function reassignCase(caseId, agentId, actor = 'Manager') {
  const c = await db.cases.get(caseId);
  const agent = await db.agents.get(agentId);
  await db.cases.update(caseId, { assignedAgentId: agentId, updatedAt: new Date().toISOString() });
  await logAudit(actor, `reassigned`, 'case', caseId, `${c.assignedAgentId || 'Unassigned'} → ${agent?.name}`);
  await notify(`Case #${caseId} reassigned to ${agent?.name}.`, { relatedCaseId: caseId });
}

export async function addCaseNote(caseId, text, actor = 'Agent') {
  const c = await db.cases.get(caseId);
  const notes = [...(c.notes || []), { id: crypto.randomUUID(), text, author: actor, at: new Date().toISOString() }];
  await db.cases.update(caseId, { notes, updatedAt: new Date().toISOString() });
  await logAudit(actor, 'added internal note', 'case', caseId);
}

export async function addCaseMessage(caseId, { direction, body, status = 'sent' }, actor = 'Agent') {
  const c = await db.cases.get(caseId);
  const messages = [...(c.messages || []), {
    id: crypto.randomUUID(), direction, body, status, author: actor, at: new Date().toISOString(),
  }];
  await db.cases.update(caseId, { messages, updatedAt: new Date().toISOString() });
  await logAudit(actor, direction === 'outbound' ? 'sent response to customer' : 'logged customer reply', 'case', caseId);
  if (direction === 'inbound') {
    await notify(`Customer replied to Case #${caseId}.`, { relatedCaseId: caseId });
  }
}

export async function linkRelatedCase(caseId, relatedId, actor = 'Agent') {
  const c = await db.cases.get(caseId);
  const relatedCaseIds = Array.from(new Set([...(c.relatedCaseIds || []), relatedId]));
  await db.cases.update(caseId, { relatedCaseIds });
  await logAudit(actor, 'linked related case', 'case', caseId, `→ #${relatedId}`);
}

// ---------- SLA sweep (called periodically from context) ----------

export async function sweepSla() {
  const open = await db.cases.where('status').noneOf(['Resolved', 'Closed']).toArray();
  const now = Date.now();
  for (const c of open) {
    const state = computeSlaState(c.slaResolutionDeadline, { now, createdAt: c.createdAt });
    if (state !== c.slaState) {
      await db.cases.update(c.id, { slaState: state });
      if (state === 'Breached') {
        await logAudit('System', 'SLA breached', 'case', c.id);
        await notify(`Case #${c.id} has breached its SLA.`, { type: 'critical', relatedCaseId: c.id });
      } else if (state === 'At Risk') {
        await logAudit('System', 'SLA at risk', 'case', c.id);
        await notify(`Case #${c.id} SLA is at risk.`, { type: 'warn', relatedCaseId: c.id });
      }
    }
  }
}

// ---------- Analytics ----------

export async function computeDashboardMetrics() {
  const cases = await db.cases.toArray();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const open = cases.filter((c) => !['Resolved', 'Closed'].includes(c.status));
  const resolvedToday = cases.filter((c) => c.resolvedAt && new Date(c.resolvedAt) >= today);
  const resolved = cases.filter((c) => c.resolutionMins != null);
  const avgResolutionMins = resolved.length
    ? Math.round(resolved.reduce((s, c) => s + c.resolutionMins, 0) / resolved.length)
    : null;

  const byCategory = {};
  const byPriority = {};
  const byDepartment = {};
  for (const c of cases) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] || 0) + 1;
    byDepartment[c.department] = (byDepartment[c.department] || 0) + 1;
  }

  const satisfactionScores = (await db.customers.toArray()).map((c) => c.satisfaction).filter((s) => s != null);
  const avgSatisfaction = satisfactionScores.length
    ? Number((satisfactionScores.reduce((s, v) => s + v, 0) / satisfactionScores.length).toFixed(1))
    : null;

  const resolvedOrClosed = cases.filter((c) => ['Resolved', 'Closed'].includes(c.status)).length;
  const resolutionRate = cases.length ? Math.round((resolvedOrClosed / cases.length) * 100) : null;

  return {
    totalCases: cases.length,
    openCases: open.length,
    criticalCases: cases.filter((c) => c.priority === 'Critical' && !['Resolved', 'Closed'].includes(c.status)).length,
    highPriority: cases.filter((c) => ['High', 'Critical'].includes(c.priority) && !['Resolved', 'Closed'].includes(c.status)).length,
    slaAtRisk: cases.filter((c) => c.slaState === 'At Risk' && !['Resolved', 'Closed'].includes(c.status)).length,
    slaBreached: cases.filter((c) => c.slaState === 'Breached' && !['Resolved', 'Closed'].includes(c.status)).length,
    resolvedToday: resolvedToday.length,
    resolvedCases: resolvedOrClosed,
    resolutionRate,
    avgResolutionMins,
    avgSatisfaction,
    byCategory, byPriority, byDepartment,
  };
}

export async function detectRecurringIssues({ windowDays = 7 } = {}) {
  const cases = await db.cases.toArray();
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const prevWindowMs = windowMs;

  const recent = cases.filter((c) => now - new Date(c.createdAt).getTime() < windowMs);
  const previous = cases.filter((c) => {
    const age = now - new Date(c.createdAt).getTime();
    return age >= windowMs && age < windowMs + prevWindowMs;
  });

  const countBy = (arr) => arr.reduce((acc, c) => {
    const key = `${c.category}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const recentCounts = countBy(recent);
  const prevCounts = countBy(previous);

  return Object.entries(recentCounts)
    .filter(([, count]) => count >= 3)
    .map(([category, count]) => {
      const prev = prevCounts[category] || 0;
      const changePct = prev > 0 ? Math.round(((count - prev) / prev) * 100) : null;
      return { category, count, windowDays, changePct };
    })
    .sort((a, b) => b.count - a.count);
}

// ---------- Backup / restore ----------

export async function exportBackup() {
  const tables = ['customers', 'cases', 'agents', 'knowledgeArticles', 'notifications', 'auditEvents', 'settings'];
  const data = {};
  for (const t of tables) data[t] = await db[t].toArray();
  return { exportedAt: new Date().toISOString(), app: 'customer-intellassist', version: 1, data };
}

export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object') return 'This file is not a valid backup — it is not a JSON object.';
  if (backup.app !== 'customer-intellassist') return 'This file was not created by Customer IntellAssist.';
  if (!backup.data || typeof backup.data !== 'object') return 'This backup file is missing its data section.';
  const requiredTables = ['customers', 'cases'];
  for (const t of requiredTables) {
    if (!Array.isArray(backup.data[t])) return `This backup file is missing or has an invalid "${t}" section.`;
  }
  return null;
}

export async function restoreBackup(backup, { mode = 'replace' } = {}) {
  const validationError = validateBackup(backup);
  if (validationError) throw new Error(validationError);
  const tables = ['customers', 'cases', 'agents', 'knowledgeArticles', 'notifications', 'auditEvents', 'settings'];
  await db.transaction('rw', tables.map((t) => db[t]), async () => {
    for (const t of tables) {
      if (!backup.data[t]) continue;
      if (mode === 'replace') await db[t].clear();
      await db[t].bulkPut(backup.data[t]);
    }
  });
}

// ---------- Bulk import ----------

/**
 * Imports pre-validated case rows (from validateCaseImportRows in lib/csv.js).
 * Each row runs through the exact same automated pipeline as a manually
 * created case — classification, priority, routing, SLA calculation, and
 * auto-assignment — so a bulk import is genuinely automated triage, not
 * just raw data insertion. Continues past a single row's failure rather
 * than aborting the whole batch, and returns a full result summary.
 */
export async function importCasesFromCsv(validRows, actor = 'Workspace') {
  const created = [];
  const failed = [];

  for (const { rowNumber, row } of validRows) {
    try {
      const customerId = await findOrCreateCustomerByEmail(
        { name: row.customerName.trim(), email: row.customerEmail.trim() }, actor
      );
      const caseId = await createCase({
        subject: row.subject.trim(), description: row.description.trim(), customerId, actor,
      });
      created.push(caseId);
    } catch (err) {
      failed.push({ rowNumber, reason: err.message });
    }
  }

  await logAudit(actor, 'imported cases from CSV', 'workspace', 0,
    `${created.length} created, ${failed.length} failed`);
  if (created.length > 0) {
    await notify(`Imported ${created.length} case${created.length === 1 ? '' : 's'} from CSV.`, { type: 'info' });
  }

  return { created, failed };
}

export { setSetting, getSetting };

// ---------- Knowledge base ----------

/** Fetches all knowledge articles, newest-updated first. Sorted client-side
 * so this never depends on `updatedAt` being part of the Dexie index. */
export async function listKnowledgeArticles() {
  const rows = await db.knowledgeArticles.toArray();
  return rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
