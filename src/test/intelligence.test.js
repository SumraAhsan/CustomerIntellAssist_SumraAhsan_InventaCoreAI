import { describe, it, expect } from 'vitest';
import { classifyCategory, classifySentiment, classifyPriority, detectMissingInfo, findRelatedCases, analyzeCase } from '../lib/intelligence';

describe('classifyCategory', () => {
  it('detects a billing issue from keywords', () => {
    const r = classifyCategory('Charged twice', 'I was charged twice for my subscription this month, please check my invoice.');
    expect(r.category).toBe('Billing');
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it('falls back to General when nothing matches', () => {
    const r = classifyCategory('Hello', 'just saying hi, no real issue here at all');
    expect(r.category).toBe('General');
  });
});

describe('classifySentiment', () => {
  it('flags urgent language', () => {
    const r = classifySentiment('I need this fixed immediately, this is an emergency.');
    expect(r.sentiment).toBe('urgent');
  });

  it('flags angry language', () => {
    const r = classifySentiment('This is absolutely ridiculous and unacceptable service.');
    expect(r.sentiment).toBe('angry');
  });

  it('defaults to neutral for plain text', () => {
    const r = classifySentiment('Could you tell me more about your pricing plans?');
    expect(r.sentiment).toBe('neutral');
  });
});

describe('classifyPriority', () => {
  it('assigns high/critical priority to angry billing complaints', () => {
    const r = classifyPriority('Billing', 'angry', 'I was charged twice, this is unacceptable, fix it immediately.');
    expect(['High', 'Critical']).toContain(r.priority);
  });

  it('assigns low priority to a calm general question', () => {
    const r = classifyPriority('General', 'neutral', 'Just wondering about your plans, no rush at all.');
    expect(r.priority).toBe('Low');
  });
});

describe('detectMissingInfo', () => {
  it('flags a missing order number for a delivery complaint with none mentioned', () => {
    const missing = detectMissingInfo('Delivery', 'My package never arrived and I am upset about it.');
    expect(missing).toContain('Order number / tracking ID');
  });

  it('does not flag order number when one is present', () => {
    const missing = detectMissingInfo('Delivery', 'My order #4821 never arrived, shipped last monday.');
    expect(missing).not.toContain('Order number / tracking ID');
  });
});

describe('findRelatedCases', () => {
  const existing = [
    { id: 1, customerId: 5, subject: 'Charged twice for subscription', description: 'I was charged twice for my subscription this month.', category: 'Billing', createdAt: new Date().toISOString() },
    { id: 2, customerId: 9, subject: 'Package never arrived', description: 'My delivery never showed up.', category: 'Delivery', createdAt: new Date().toISOString() },
  ];

  it('finds a same-customer duplicate as related', () => {
    const related = findRelatedCases({ subject: 'Charged twice again', description: 'I was charged twice for my subscription again this month.', category: 'Billing', customerId: 5 }, existing);
    expect(related.some((r) => r.id === 1)).toBe(true);
  });

  it('does not match unrelated categories with no text overlap', () => {
    const related = findRelatedCases({ subject: 'Cannot log in', description: 'My login keeps failing with an invalid credentials error.', category: 'Technical', customerId: 42 }, existing);
    expect(related.length).toBe(0);
  });
});

describe('analyzeCase (full pipeline)', () => {
  it('produces a coherent bundle for a realistic complaint', () => {
    const result = analyzeCase(
      'Charged twice for my subscription',
      'I was charged twice for my subscription and I already contacted support yesterday. My account still shows a payment problem.',
      [],
      1
    );
    expect(result.category.category).toBe('Billing');
    expect(result.department).toBe('Billing');
    expect(['High', 'Critical']).toContain(result.priority.priority);
    expect(Array.isArray(result.missingInfo)).toBe(true);
  });
});
