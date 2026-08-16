// Deterministic, local response drafting — no external API required.
// The agent always reviews/edits before it's marked as sent.

const OPENERS = {
  Professional: (name) => `Dear ${name},`,
  Friendly: (name) => `Hi ${name},`,
  Concise: (name) => `Hi ${name},`,
  Apologetic: (name) => `Dear ${name}, I'm sorry for the trouble this has caused.`,
  Informational: (name) => `Hello ${name},`,
};

const CLOSERS = {
  Professional: 'Thank you for your patience.\n\nBest regards,\nCustomer Support Team',
  Friendly: "Thanks so much for bearing with us!\n\nCheers,\nSupport Team",
  Concise: '— Support Team',
  Apologetic: 'Again, I apologize for the inconvenience — we appreciate your patience.\n\nSincerely,\nSupport Team',
  Informational: 'Let us know if you have further questions.\n\nRegards,\nSupport Team',
};

const CATEGORY_BODY = {
  Billing: 'we\'ve reviewed the charge on your account related to your recent report.',
  Refund: 'we\'ve reviewed your refund request and are processing it according to our policy.',
  Technical: 'we\'ve looked into the technical issue you reported and are working on a fix.',
  Account: 'we\'ve reviewed your account and are addressing the issue you described.',
  Delivery: 'we\'ve checked the status of your order/delivery and here is an update.',
  Subscription: 'we\'ve reviewed your subscription request and processed the requested change.',
  General: 'thank you for reaching out — here is an update on your enquiry.',
};

export function generateResponseDraft({ customerName, category, tone = 'Professional', missingInfo = [], caseId }) {
  const opener = (OPENERS[tone] || OPENERS.Professional)(customerName);
  const body = CATEGORY_BODY[category] || CATEGORY_BODY.General;
  let missingBlock = '';
  if (missingInfo.length) {
    missingBlock = `\n\nTo continue, could you please provide the following?\n${missingInfo.map((m) => `- ${m}`).join('\n')}`;
  }
  const closer = CLOSERS[tone] || CLOSERS.Professional;

  return `${opener}\n\nRegarding case ${caseId}, ${body}${missingBlock}\n\n${closer}`;
}
