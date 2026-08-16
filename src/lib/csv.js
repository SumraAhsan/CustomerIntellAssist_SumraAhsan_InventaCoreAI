// A small, dependency-free CSV parser. Handles quoted fields (including
// commas and newlines inside quotes) and escaped quotes ("" -> "), which
// covers real-world CSV exported from Excel/Sheets — the two most likely
// sources for a file someone uploads here. No external library needed for
// this scope, keeping the "no unnecessary dependencies" principle intact.

/** Parses raw CSV text into { headers: string[], rows: object[] }. */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      // skip — \r\n handled by the following \n
    } else {
      field += char;
    }
  }
  // Final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] };

  const headers = nonEmptyRows[0].map((h) => h.trim());
  const dataRows = nonEmptyRows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { headers, rows: dataRows };
}

const CASE_IMPORT_COLUMNS = ['customerName', 'customerEmail', 'subject', 'description'];

export function csvImportTemplate() {
  const header = CASE_IMPORT_COLUMNS.join(',');
  const example1 = '"Ayesha Khan","ayesha@example.com","Charged twice for my subscription","I was charged twice for my subscription this month, please refund the duplicate charge."';
  const example2 = '"Bilal Ahmed","bilal@example.com","Order never arrived","My order was supposed to arrive last week and tracking has not updated since."';
  return `${header}\n${example1}\n${example2}`;
}

/**
 * Validates parsed CSV rows for case import. Returns { valid, invalid } where
 * invalid entries carry the row number (1-indexed, matching what a person
 * sees in a spreadsheet) and a specific, human-readable reason.
 */
export function validateCaseImportRows(rows) {
  const valid = [];
  const invalid = [];
  const emailRe = /^\S+@\S+\.\S+$/;

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for 1-indexing, +1 because row 1 is the header
    const missing = CASE_IMPORT_COLUMNS.filter((col) => !row[col]?.trim());
    if (missing.length > 0) {
      invalid.push({ rowNumber, row, reason: `Missing: ${missing.join(', ')}` });
      return;
    }
    if (!emailRe.test(row.customerEmail.trim())) {
      invalid.push({ rowNumber, row, reason: 'Invalid email format' });
      return;
    }
    if (row.description.trim().length < 8) {
      invalid.push({ rowNumber, row, reason: 'Description is too short to analyze meaningfully' });
      return;
    }
    valid.push({ rowNumber, row });
  });

  return { valid, invalid };
}

export { CASE_IMPORT_COLUMNS };
