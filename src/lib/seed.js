// Realistic sample data — loaded only when the user explicitly chooses it,
// either during first-run Workspace Setup or later from
// Settings -> Data Management -> Load Sample Data. Every sample record is
// tagged `sample: true` so it can be identified and cleared independently
// of anything the user creates themselves.
import { db, setSetting } from '../db/db';
import { analyzeCase } from './intelligence';
import { computeSlaDeadlines, computeSlaState } from './sla';
import { DEFAULT_SLA_CONFIG, DEPARTMENTS } from './constants';
import { logAudit, notify } from './repo';

const FIRST_NAMES = ['Ayesha', 'Bilal', 'Sana', 'Hamza', 'Mariam', 'Usman', 'Fatima', 'Ali', 'Zara', 'Omar', 'Hira', 'Danish', 'Noor', 'Faisal', 'Sara', 'Kamran', 'Amna', 'Rashid', 'Iqra', 'Talha', 'Mahnoor', 'Adeel', 'Sadia', 'Waqas', 'Rabia', 'Junaid', 'Anum', 'Zeeshan', 'Laiba', 'Salman'];
const LAST_NAMES = ['Khan', 'Ahmed', 'Malik', 'Raza', 'Hussain', 'Sheikh', 'Iqbal', 'Farooq', 'Butt', 'Qureshi', 'Chaudhry', 'Baig', 'Javed', 'Aslam', 'Riaz'];

const SUBJECTS_BY_CATEGORY = {
  Billing: ['Charged twice for my subscription', 'Invoice amount does not match my plan', 'Unexpected charge on my card'],
  Refund: ['Refund never received', "Haven't received my refund yet", 'Requesting refund for cancelled order'],
  Technical: ['Cannot log into my account', 'App keeps crashing on checkout', 'Getting an error when uploading files'],
  Account: ['Account suspended without explanation', 'Need help verifying my account', 'Cannot change my email address'],
  Delivery: ['Order has not arrived', 'Package arrived damaged', 'Tracking shows no updates for days'],
  Subscription: ['Want to cancel my subscription', 'Subscription auto-renewed by mistake', 'Trying to downgrade my plan'],
  General: ['Question about your pricing plans', 'How do I export my data?', 'Asking about enterprise features'],
};

const DESCRIPTIONS_BY_CATEGORY = {
  Billing: [
    'I was charged twice for my subscription this month and I already contacted support yesterday about it. My account still shows a payment problem and this is really frustrating.',
    'My invoice for order #4821 shows $49 but my plan is only supposed to be $29. Please check this urgently.',
  ],
  Refund: [
    'I cancelled my order over a week ago and was told I would get a refund within 5 business days. It has been 9 days and still nothing.',
    'Requesting a refund for order placed on 2026-07-20, the item never arrived.',
  ],
  Technical: [
    'Every time I try to log in I get an error saying invalid credentials, even after resetting my password twice. This is urgent, I need access today.',
    'The app crashes immediately when I try to upload a file on my Android phone. Started happening after the last update.',
  ],
  Account: [
    'My account was suspended and nobody told me why. I have been a customer for 2 years and this is unacceptable.',
    'I need to verify my account but the verification email never arrives, please help.',
  ],
  Delivery: [
    'My order #7734 was supposed to arrive last Tuesday and tracking has not updated since. This is the second time this has happened.',
    'The package I received today arrived completely damaged, the box was crushed.',
  ],
  Subscription: [
    'I tried to cancel my subscription last month but I was still charged again yesterday. Please cancel this immediately and refund me.',
    'My plan auto-renewed even though I turned off auto-renew in settings.',
  ],
  General: [
    'Hi, I was wondering what the difference is between your Pro and Business plans.',
    'Is there a way to export all of my data as a CSV file?',
  ],
};

const AGENT_NAMES = ['Hassan Tariq', 'Mehak Fatima', 'Bilal Ahmad', 'Sidra Khan', 'Owais Malik', 'Rida Sheikh', 'Zain Abbas', 'Nimra Iqbal'];

const KNOWLEDGE_ARTICLES = [
  { title: 'Refund Policy Overview', category: 'Refund', content: 'Refunds are processed within 5–7 business days to the original payment method. Orders cancelled within 24 hours qualify for a full refund.' },
  { title: 'How Billing Cycles Work', category: 'Billing', content: 'Subscriptions renew on the same calendar day each billing period. Duplicate charges are usually caused by a retried failed payment and are automatically reversed within 3 days.' },
  { title: 'Troubleshooting Login Errors', category: 'Technical', content: 'Clear cookies, confirm caps-lock is off, and try a password reset. Persistent "invalid credentials" errors after reset usually indicate an account lock — escalate to Account Services.' },
  { title: 'Account Verification Steps', category: 'Account', content: 'Verification emails can take up to 10 minutes and may land in spam. If not received after 30 minutes, manually verify via Account Services with a government ID.' },
  { title: 'Delivery Delay Guidelines', category: 'Delivery', content: 'Domestic delivery SLA is 3–5 business days. If tracking has not updated in 48 hours, open an investigation with the courier and offer the customer a status update.' },
  { title: 'Cancelling or Changing a Subscription', category: 'Subscription', content: 'Customers can cancel anytime from Settings → Subscription. Cancellations take effect at the end of the current billing cycle unless a refund is explicitly requested.' },
  { title: 'Handling Angry or Frustrated Customers', category: 'General', content: 'Acknowledge the frustration first, avoid deflecting responsibility, and give a concrete next step with a timeframe.' },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randDate(daysAgoMax) { return new Date(Date.now() - Math.random() * daysAgoMax * 24 * 60 * 60 * 1000); }

export async function hasAnyData() {
  const count = await db.customers.count();
  return count > 0;
}

export async function hasSampleData() {
  const count = await db.customers.filter((c) => c.sample === true).count();
  return count > 0;
}

export async function loadSampleData(actor = 'Workspace') {
  // The whole operation — including the "is this workspace empty?" check —
  // runs inside one transaction, so two overlapping calls (e.g. a double
  // click) can never both pass the check and seed data twice. IndexedDB
  // serializes transactions that touch the same tables.
  const tables = [db.customers, db.cases, db.agents, db.knowledgeArticles, db.settings, db.notifications, db.auditEvents];

  await db.transaction('rw', tables, async () => {
    const existing = await db.customers.count();
    if (existing > 0) {
      throw new Error('Sample data can only be loaded into an empty workspace — this workspace already has customers.');
    }

    const slaConfig = await getSlaConfigOrDefault();
    await setSetting('slaConfig', slaConfig);

    for (let i = 0; i < AGENT_NAMES.length; i += 1) {
      const dept = DEPARTMENTS[i % DEPARTMENTS.length];
      await db.agents.add({ name: AGENT_NAMES[i], department: dept, role: i === 0 ? 'Manager' : 'Agent', sample: true });
    }

    for (const art of KNOWLEDGE_ARTICLES) {
      await db.knowledgeArticles.add({
        ...art, tags: [art.category.toLowerCase()], status: 'Published',
        createdBy: 'Sample Data', createdAt: randDate(60).toISOString(), updatedAt: randDate(10).toISOString(), sample: true,
      });
    }

    const customerIds = [];
    const customerCount = 38;
    for (let i = 0; i < customerCount; i += 1) {
      const first = pick(FIRST_NAMES); const last = pick(LAST_NAMES);
      const name = `${first} ${last}`;
      const created = randDate(200);
      const id = await db.customers.add({
        name,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
        phone: `+92 3${Math.floor(10 + Math.random() * 89)} ${Math.floor(1000000 + Math.random() * 8999999)}`,
        accountStatus: Math.random() > 0.08 ? 'Active' : 'Suspended',
        createdAt: created.toISOString(),
        lastContact: created.toISOString(),
        satisfaction: Math.random() > 0.3 ? Math.round((3 + Math.random() * 2) * 10) / 10 : null,
        tags: [], notes: '', sample: true,
      });
      customerIds.push(id);
    }

    const runningCases = [];
    const caseCount = 72;
    const categories = Object.keys(SUBJECTS_BY_CATEGORY);

    for (let i = 0; i < caseCount; i += 1) {
      const category = pick(categories);
      const subject = pick(SUBJECTS_BY_CATEGORY[category]);
      const description = pick(DESCRIPTIONS_BY_CATEGORY[category]);
      const customerId = pick(customerIds);
      const createdAt = randDate(30);

      const analysis = analyzeCase(subject, description, runningCases, customerId);
      const deadlines = computeSlaDeadlines(analysis.priority.priority, createdAt.toISOString(), slaConfig);

      const roll = Math.random();
      let status = 'Open'; let resolvedAt = null; let resolutionMins = null;
      if (roll < 0.45) {
        status = 'Resolved';
        const resolveDelayMins = Math.min(20 + Math.random() * 600, (Date.now() - createdAt.getTime()) / 60000);
        resolvedAt = new Date(createdAt.getTime() + resolveDelayMins * 60000);
        resolutionMins = Math.round(resolveDelayMins);
      } else if (roll < 0.55) {
        status = 'Closed';
        const resolveDelayMins = Math.min(60 + Math.random() * 800, (Date.now() - createdAt.getTime()) / 60000);
        resolvedAt = new Date(createdAt.getTime() + resolveDelayMins * 60000);
        resolutionMins = Math.round(resolveDelayMins);
      } else if (roll < 0.7) status = 'In Progress';
      else if (roll < 0.8) status = 'Assigned';
      else if (roll < 0.88) status = 'Waiting for Customer';
      else if (roll < 0.95) status = 'Escalated';

      const slaState = computeSlaState(deadlines.resolutionDeadline, {
        now: Date.now(), createdAt: createdAt.toISOString(), resolved: !!resolvedAt,
      });

      const agents = await db.agents.toArray();
      const assignedAgentId = status === 'Open' ? null : pick(agents)?.id ?? null;

      const caseRecord = {
        customerId, subject, description,
        category: analysis.category.category, subcategory: null, priority: analysis.priority.priority,
        status, sentiment: analysis.sentiment.sentiment, urgency: analysis.sentiment.sentiment === 'urgent' ? 'High' : 'Normal',
        department: analysis.department, assignedAgentId,
        createdAt: createdAt.toISOString(), updatedAt: (resolvedAt || createdAt).toISOString(),
        slaFirstResponseDeadline: deadlines.firstResponseDeadline, slaResolutionDeadline: deadlines.resolutionDeadline,
        slaState, resolvedAt: resolvedAt ? resolvedAt.toISOString() : null, resolutionMins,
        tags: [], relatedCaseIds: analysis.related.map((r) => r.id).filter((id) => runningCases.some((rc) => rc.id === id)),
        missingInfo: analysis.missingInfo, analysis, messages: [], notes: [], sample: true,
      };

      const id = await db.cases.add(caseRecord);
      runningCases.push({ ...caseRecord, id });
    }

    await logAudit(actor, 'loaded sample data', 'workspace', 0, `${customerCount} customers, ${caseCount} cases`);
    await notify('Sample data has been loaded to help you explore the workspace.', { type: 'info' });

    return { customerCount, caseCount };
  });
}

export async function clearSampleData(actor = 'Workspace') {
  await db.transaction('rw', [db.cases, db.customers, db.agents, db.knowledgeArticles], async () => {
    await db.cases.filter((c) => c.sample === true).delete();
    await db.customers.filter((c) => c.sample === true).delete();
    await db.agents.filter((a) => a.sample === true).delete();
    await db.knowledgeArticles.filter((a) => a.sample === true).delete();
  });
  await logAudit(actor, 'cleared sample data', 'workspace', 0);
}

async function getSlaConfigOrDefault() {
  const row = await db.settings.get('slaConfig');
  return row ? row.value : DEFAULT_SLA_CONFIG;
}
