import { DEFAULT_SLA_CONFIG } from './constants';

export function computeSlaDeadlines(priority, createdAt, config = DEFAULT_SLA_CONFIG) {
  const cfg = config[priority] || DEFAULT_SLA_CONFIG.Medium;
  const created = new Date(createdAt).getTime();
  return {
    firstResponseDeadline: new Date(created + cfg.firstResponseMins * 60000).toISOString(),
    resolutionDeadline: new Date(created + cfg.resolutionMins * 60000).toISOString(),
  };
}

/** Returns 'Healthy' | 'At Risk' | 'Breached' relative to now, for an unresolved case. */
export function computeSlaState(resolutionDeadline, { atRiskThresholdPct = 0.2, now = Date.now(), resolved = false, createdAt } = {}) {
  if (resolved) return 'Healthy';
  const deadline = new Date(resolutionDeadline).getTime();
  if (now >= deadline) return 'Breached';
  if (createdAt) {
    const total = deadline - new Date(createdAt).getTime();
    const remaining = deadline - now;
    if (total > 0 && remaining / total <= atRiskThresholdPct) return 'At Risk';
  }
  return 'Healthy';
}

export function formatRemaining(deadline, now = Date.now()) {
  const diff = new Date(deadline).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `${label} left` : `${label} overdue`;
}

/**
 * Validates an SLA config object before it's persisted. Every priority must
 * have a positive whole-number minute value for both targets — this exists
 * because the config flows directly into date arithmetic (computeSlaDeadlines),
 * so an empty field, a negative number, or NaN would silently corrupt the SLA
 * deadline of every case created afterward.
 */
export function isValidSlaConfig(config, priorities) {
  return priorities.every((p) => {
    const fr = config?.[p]?.firstResponseMins;
    const res = config?.[p]?.resolutionMins;
    return Number.isInteger(fr) && fr >= 1 && Number.isInteger(res) && res >= 1;
  });
}
