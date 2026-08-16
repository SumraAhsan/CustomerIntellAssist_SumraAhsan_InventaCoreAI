export const CATEGORIES = ['Billing', 'Technical', 'Account', 'Delivery', 'Subscription', 'Refund', 'General'];

export const CATEGORY_DEPARTMENT = {
  Billing: 'Billing',
  Refund: 'Billing',
  Technical: 'Technical Support',
  Account: 'Account Services',
  Delivery: 'Logistics',
  Subscription: 'Billing',
  General: 'General Support',
};

export const DEPARTMENTS = ['Billing', 'Technical Support', 'Account Services', 'Logistics', 'General Support'];

export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export const STATUSES = [
  'New',
  'Analyzing',
  'Open',
  'Assigned',
  'Waiting for Customer',
  'In Progress',
  'Escalated',
  'Resolved',
  'Closed',
];

// Which statuses a case may move to from a given status — prevents nonsensical transitions.
export const STATUS_TRANSITIONS = {
  New: ['Analyzing'],
  Analyzing: ['Open'],
  Open: ['Assigned', 'Waiting for Customer', 'Escalated'],
  Assigned: ['In Progress', 'Waiting for Customer', 'Escalated'],
  'In Progress': ['Waiting for Customer', 'Resolved', 'Escalated'],
  'Waiting for Customer': ['In Progress', 'Escalated'],
  Escalated: ['In Progress', 'Resolved'],
  Resolved: ['Closed', 'In Progress'],
  Closed: [],
};

export const SENTIMENTS = ['positive', 'neutral', 'frustrated', 'angry', 'urgent'];

export const ROLES = ['Administrator', 'Manager', 'Agent', 'Viewer'];

// Sample, configurable SLA targets — editable in Settings. Not an industry standard.
export const DEFAULT_SLA_CONFIG = {
  Critical: { firstResponseMins: 15, resolutionMins: 120 },
  High: { firstResponseMins: 30, resolutionMins: 480 },
  Medium: { firstResponseMins: 240, resolutionMins: 1440 },
  Low: { firstResponseMins: 720, resolutionMins: 4320 },
};

export const PRIORITY_COLOR = {
  Critical: 'critical',
  High: 'warn',
  Medium: 'info',
  Low: 'success',
};

export const SLA_STATE_COLOR = {
  Healthy: 'success',
  'At Risk': 'warn',
  Breached: 'critical',
};
