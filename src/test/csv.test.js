import { describe, it, expect } from 'vitest';
import { parseCsv, validateCaseImportRows, csvImportTemplate } from '../lib/csv';

describe('parseCsv', () => {
  it('parses a simple comma-separated file with headers', () => {
    const { headers, rows } = parseCsv('a,b,c\n1,2,3\n4,5,6');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([{ a: '1', b: '2', c: '3' }, { a: '4', b: '5', c: '6' }]);
  });

  it('handles quoted fields containing commas', () => {
    const { rows } = parseCsv('name,note\n"Doe, Jane","Says ""hello"" often"');
    expect(rows[0]).toEqual({ name: 'Doe, Jane', note: 'Says "hello" often' });
  });

  it('handles quoted fields containing newlines', () => {
    const { rows } = parseCsv('name,note\n"Ali","Line one\nLine two"');
    expect(rows[0].note).toBe('Line one\nLine two');
  });

  it('returns empty results for an empty file', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('handles a file with only headers and no data rows', () => {
    const { headers, rows } = parseCsv('a,b,c\n');
    expect(headers).toEqual(['a', 'b', 'c']);
    expect(rows).toEqual([]);
  });
});

describe('validateCaseImportRows', () => {
  it('accepts well-formed rows', () => {
    const rows = [{ customerName: 'Ayesha Khan', customerEmail: 'ayesha@example.com', subject: 'Refund needed', description: 'I never received my refund from last week.' }];
    const { valid, invalid } = validateCaseImportRows(rows);
    expect(valid.length).toBe(1);
    expect(invalid.length).toBe(0);
    expect(valid[0].rowNumber).toBe(2);
  });

  it('flags a row with a missing required field', () => {
    const rows = [{ customerName: '', customerEmail: 'a@example.com', subject: 'x', description: 'A description long enough to pass.' }];
    const { valid, invalid } = validateCaseImportRows(rows);
    expect(valid.length).toBe(0);
    expect(invalid[0].reason).toMatch(/Missing/);
    expect(invalid[0].reason).toMatch(/customerName/);
  });

  it('flags an invalid email format', () => {
    const rows = [{ customerName: 'Bilal', customerEmail: 'not-an-email', subject: 'x', description: 'A description long enough to pass validation.' }];
    const { invalid } = validateCaseImportRows(rows);
    expect(invalid[0].reason).toMatch(/email/i);
  });

  it('flags a description that is too short to analyze', () => {
    const rows = [{ customerName: 'Bilal', customerEmail: 'bilal@example.com', subject: 'x', description: 'short' }];
    const { invalid } = validateCaseImportRows(rows);
    expect(invalid[0].reason).toMatch(/too short/i);
  });

  it('assigns correct spreadsheet-style row numbers accounting for the header', () => {
    const rows = [
      { customerName: 'A', customerEmail: 'a@example.com', subject: 'x', description: 'Valid description here for row two.' },
      { customerName: '', customerEmail: '', subject: '', description: '' },
    ];
    const { valid, invalid } = validateCaseImportRows(rows);
    expect(valid[0].rowNumber).toBe(2);
    expect(invalid[0].rowNumber).toBe(3);
  });
});

describe('csvImportTemplate', () => {
  it('produces a template whose rows all pass validation', () => {
    const { rows } = parseCsv(csvImportTemplate());
    const { valid, invalid } = validateCaseImportRows(rows);
    expect(invalid.length).toBe(0);
    expect(valid.length).toBeGreaterThan(0);
  });
});
