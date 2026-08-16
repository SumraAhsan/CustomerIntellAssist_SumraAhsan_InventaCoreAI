// ---------------------------------------------------------------------------
// Local Intelligence Engine
//
// This is deterministic, rule-based, and runs 100% on-device — no external
// AI API required. It is intentionally transparent: every output includes
// *why* it was produced, so it can be shown to the agent as a suggestion
// rather than an infallible verdict. See lib/aiProvider.js for the
// pluggable layer this sits behind (local engine is always the fallback).
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS = {
  Billing: ['charged', 'charge', 'invoice', 'payment', 'bill', 'billing', 'double charged', 'overcharged', 'transaction', 'receipt'],
  Refund: ['refund', 'money back', 'reimburse', 'return my payment', 'chargeback'],
  Technical: ['error', 'bug', 'not working', 'crash', 'login', 'password', 'broken', 'glitch', "can't access", 'cannot access', '404', 'freeze', 'loading forever'],
  Account: ['account', 'verify', 'verification', 'locked', 'suspended', 'profile', 'username', 'email change', 'two factor', '2fa'],
  Delivery: ['delivery', 'shipment', 'shipping', 'package', 'order', 'tracking', 'late', 'delayed', 'courier', 'arrived damaged', 'lost package'],
  Subscription: ['subscription', 'cancel', 'renew', 'renewal', 'plan', 'upgrade', 'downgrade', 'membership'],
  General: ['question', 'how do i', 'wondering', 'information', 'enquiry', 'inquiry'],
};

const URGENCY_WORDS = ['immediately', 'urgent', 'asap', 'right now', 'today', 'emergency', 'legal', 'lawyer', 'cancel my account'];
const ANGRY_WORDS = ['furious', 'ridiculous', 'unacceptable', 'terrible', 'worst', 'scam', 'angry', 'disgusted', 'never again', 'awful'];
const FRUSTRATED_WORDS = ['frustrated', 'again', 'still', 'already contacted', 'twice', 'multiple times', 'still not', "doesn't work", 'not resolved'];
const POSITIVE_WORDS = ['thanks', 'thank you', 'great', 'appreciate', 'awesome', 'love', 'happy'];

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreKeywordHits(haystack, words) {
  const lower = haystack.toLowerCase();
  let hits = 0;
  const matched = [];
  for (const w of words) {
    if (lower.includes(w)) {
      hits += 1;
      matched.push(w);
    }
  }
  return { hits, matched };
}

/** Classify category from subject+description. Returns {category, confidence, reasons}. */
export function classifyCategory(subject, description) {
  const text = `${subject} ${description}`;
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, words]) => {
    const { hits, matched } = scoreKeywordHits(text, words);
    return { category, hits, matched };
  });
  scores.sort((a, b) => b.hits - a.hits);
  const top = scores[0];
  const totalHits = scores.reduce((s, c) => s + c.hits, 0) || 1;

  if (!top || top.hits === 0) {
    return { category: 'General', confidence: 0.4, reasons: ['No strong keyword match — defaulted to General.'] };
  }
  const confidence = Math.min(0.97, 0.55 + (top.hits / totalHits) * 0.4 + top.hits * 0.05);
  return {
    category: top.category,
    confidence: Number(confidence.toFixed(2)),
    reasons: [`Matched keywords: ${top.matched.join(', ')}`],
  };
}

/** Sentiment from description text. */
export function classifySentiment(description) {
  const text = description.toLowerCase();
  const urgent = scoreKeywordHits(text, URGENCY_WORDS);
  const angry = scoreKeywordHits(text, ANGRY_WORDS);
  const frustrated = scoreKeywordHits(text, FRUSTRATED_WORDS);
  const positive = scoreKeywordHits(text, POSITIVE_WORDS);

  if (urgent.hits > 0) return { sentiment: 'urgent', confidence: 0.85, reasons: [`Urgency language: ${urgent.matched.join(', ')}`] };
  if (angry.hits > 0) return { sentiment: 'angry', confidence: 0.8, reasons: [`Strong negative language: ${angry.matched.join(', ')}`] };
  if (frustrated.hits > 0) return { sentiment: 'frustrated', confidence: 0.7, reasons: [`Repeated-contact / frustration cues: ${frustrated.matched.join(', ')}`] };
  if (positive.hits > 0) return { sentiment: 'positive', confidence: 0.65, reasons: [`Positive language: ${positive.matched.join(', ')}`] };
  return { sentiment: 'neutral', confidence: 0.55, reasons: ['No strong sentiment cues detected.'] };
}

/** Priority from category + sentiment + explicit urgency signals. */
export function classifyPriority(category, sentiment, description) {
  const text = description.toLowerCase();
  const urgent = scoreKeywordHits(text, URGENCY_WORDS).hits > 0;
  let score = 0;
  const reasons = [];

  if (sentiment === 'angry' || sentiment === 'urgent') { score += 2; reasons.push(`Sentiment "${sentiment}" raises priority`); }
  if (sentiment === 'frustrated') { score += 1; reasons.push('Frustrated sentiment raises priority'); }
  if (urgent) { score += 2; reasons.push('Explicit urgency language found'); }
  if (['Billing', 'Refund', 'Account'].includes(category)) { score += 1; reasons.push(`${category} cases are treated as higher-risk by default`); }
  if (text.includes('twice') || text.includes('double')) { score += 1; reasons.push('Possible billing error pattern ("twice"/"double")'); }

  let priority = 'Low';
  if (score >= 4) priority = 'Critical';
  else if (score >= 3) priority = 'High';
  else if (score >= 1) priority = 'Medium';

  const confidence = Math.min(0.95, 0.5 + score * 0.1);
  return { priority, confidence: Number(confidence.toFixed(2)), reasons };
}

export function suggestDepartment(category) {
  const map = {
    Billing: 'Billing', Refund: 'Billing', Subscription: 'Billing',
    Technical: 'Technical Support',
    Account: 'Account Services',
    Delivery: 'Logistics',
    General: 'General Support',
  };
  return map[category] || 'General Support';
}

/** Detect likely-missing information the agent will need. */
export function detectMissingInfo(category, description) {
  const text = description.toLowerCase();
  const missing = [];

  const hasOrderNumber = /(order|invoice|ticket|ref)\s*#?\s*\w{3,}/i.test(description) || /#\d{3,}/.test(description);
  const hasDate = /(today|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[/-]\d{1,2}|\b\d{4}\b)/i.test(text);
  const hasAmount = /\$\s?\d+|\d+\s?(usd|pkr|rs\.?)/i.test(text);

  if (['Billing', 'Refund', 'Subscription'].includes(category) && !hasOrderNumber) missing.push('Order / invoice number');
  if (['Billing', 'Refund'].includes(category) && !hasAmount) missing.push('Amount charged');
  if (category === 'Delivery' && !hasOrderNumber) missing.push('Order number / tracking ID');
  if (category === 'Technical' && !/(browser|device|app|phone|laptop|error code|screenshot)/i.test(text)) missing.push('Device/browser and steps to reproduce');
  if (!hasDate) missing.push('Date the issue occurred');

  return missing;
}

/** Jaccard-style similarity between two token sets, for duplicate/related-case detection. */
function similarity(textA, textB) {
  const a = new Set(tokenize(textA));
  const b = new Set(tokenize(textB));
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/**
 * Find candidate related/duplicate cases among recent cases.
 * existingCases: array of {id, customerId, subject, description, category, createdAt}
 */
export function findRelatedCases(newCase, existingCases, { windowDays = 14, minScore = 0.18 } = {}) {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const candidates = existingCases.filter((c) => now - new Date(c.createdAt).getTime() < windowMs);

  const scored = candidates.map((c) => {
    let score = similarity(`${newCase.subject} ${newCase.description}`, `${c.subject} ${c.description}`);
    const reasons = [];
    if (score > 0) reasons.push(`${Math.round(score * 100)}% text overlap`);
    if (c.customerId === newCase.customerId) { score += 0.25; reasons.push('Same customer'); }
    if (c.category === newCase.category) { score += 0.05; reasons.push('Same category'); }
    return { ...c, score: Number(score.toFixed(2)), reasons };
  });

  return scored.filter((c) => c.score >= minScore).sort((a, b) => b.score - a.score).slice(0, 5);
}

/** Full analysis pipeline used when a case is created. */
export function analyzeCase(subject, description, existingCases, customerId) {
  const cat = classifyCategory(subject, description);
  const sent = classifySentiment(description);
  const pri = classifyPriority(cat.category, sent.sentiment, description);
  const department = suggestDepartment(cat.category);
  const missingInfo = detectMissingInfo(cat.category, description);
  const related = findRelatedCases({ subject, description, category: cat.category, customerId }, existingCases);

  return {
    category: cat, sentiment: sent, priority: pri, department, missingInfo, related,
    analyzedAt: new Date().toISOString(),
  };
}
