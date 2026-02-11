/**
 * Bank Statement Parser - Supports CSV and OFX/QFX.
 * (PDF and image parsing require AI vision and are handled separately.)
 *
 * Uses hybrid approach: rule-based column detection with bank-specific configs.
 */

export interface ParsedTransaction {
  date: string; // ISO format YYYY-MM-DD
  description: string;
  amount: number;
  merchant?: string;
  category_suggestion?: string;
  confidence: number;
  raw_data?: Record<string, unknown>;
}

export interface StatementParseResult {
  transactions: ParsedTransaction[];
  errors: string[];
  warnings: string[];
  bank_detected?: string;
  account_info?: string;
  parser_used: string;
  headers_detected?: string[];
  sample_lines?: string[];
}

// ============================================
// Date Parsing
// ============================================

const DATE_FORMATS_DMY = ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'DD/MM/YY', 'DD-MM-YY'];
const DATE_FORMATS_MDY = ['MM/DD/YYYY', 'MM/DD/YY', 'MM-DD-YYYY'];
const DATE_FORMATS_OTHER = ['YYYY-MM-DD', 'YYYY/MM/DD'];

let _detectedDateFormat: string | null = null;

function detectDateFormat(dateStrings: string[]): string {
  for (const ds of dateStrings) {
    const parts = ds.trim().split(/[/\-.]/);
    if (parts.length >= 2) {
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);
      if (!isNaN(first) && !isNaN(second)) {
        if (first > 12) return 'DMY';
        if (second > 12) return 'MDY';
      }
    }
  }
  return 'DMY'; // Default to European
}

function tryParseDate(dateStr: string): Date | null {
  dateStr = dateStr.trim();
  if (!dateStr) return null;

  // Try ISO format first
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateStr)) {
    const d = new Date(dateStr + 'T00:00:00');
    if (!isNaN(d.getTime())) return d;
  }

  // Try named month formats: "Jan 15, 2024", "15 Jan 2024", "January 15, 2024"
  const namedMonth = dateStr.match(
    /(?:(\d{1,2})\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{2,4})|(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+(\d{2,4})/i,
  );
  if (namedMonth) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  // Numeric format
  const parts = dateStr.split(/[/\-.]/);
  if (parts.length >= 3) {
    const nums = parts.map((p) => parseInt(p, 10));
    if (nums.some(isNaN)) return null;

    const hint = _detectedDateFormat || 'DMY';

    const tryOrder =
      hint === 'DMY'
        ? [
            [nums[2], nums[1], nums[0]], // DD/MM/YYYY
            [nums[2], nums[0], nums[1]], // MM/DD/YYYY fallback
          ]
        : [
            [nums[2], nums[0], nums[1]], // MM/DD/YYYY
            [nums[2], nums[1], nums[0]], // DD/MM/YYYY fallback
          ];

    for (const [yearRaw, month, day] of tryOrder) {
      let year = yearRaw;
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (d.getMonth() === month - 1 && d.getDate() === day) return d;
      }
    }
  }

  return null;
}

function setDateFormatHint(rows: string[][], dateCol: number): void {
  const dateStrings: string[] = [];
  for (const row of rows.slice(0, 20)) {
    if (dateCol < row.length) dateStrings.push(row[dateCol]);
  }
  _detectedDateFormat = detectDateFormat(dateStrings);
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ============================================
// Amount Parsing
// ============================================

function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  let cleaned = amountStr.trim();
  if (!cleaned) return null;

  let isNegative = false;

  // Check for explicit negative
  if (cleaned.startsWith('-') || cleaned.startsWith('- ')) {
    isNegative = true;
    cleaned = cleaned.replace(/^-\s*/, '');
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // Check for $- pattern
  if (cleaned.includes('$-') || cleaned.includes('$ -')) {
    isNegative = true;
  }

  // Remove currency symbols
  cleaned = cleaned.replace(/[$\u00A3\u20AC\u00A5\u20B9\u20BF]/g, '');
  cleaned = cleaned.trim();
  if (cleaned.startsWith('-')) {
    isNegative = true;
    cleaned = cleaned.slice(1);
  }

  cleaned = cleaned.replace(/,/g, '').replace(/\s/g, '');

  // Parentheses = negative
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }

  // CR/DR suffixes
  if (cleaned.toUpperCase().endsWith('CR')) {
    isNegative = false;
    cleaned = cleaned.slice(0, -2);
  } else if (cleaned.toUpperCase().endsWith('DR')) {
    isNegative = true;
    cleaned = cleaned.slice(0, -2);
  }

  const value = parseFloat(cleaned);
  if (isNaN(value)) return null;

  return isNegative ? -Math.abs(value) : Math.abs(value);
}

// ============================================
// CSV Parser
// ============================================

interface BankConfig {
  date_columns: string[];
  description_columns: string[];
  amount_columns: string[];
  debit_columns: string[];
  credit_columns: string[];
}

const BANK_CONFIGS: Record<string, BankConfig> = {
  chase: {
    date_columns: ['Transaction Date', 'Posting Date', 'Date'],
    description_columns: ['Description', 'Merchant'],
    amount_columns: ['Amount'],
    debit_columns: ['Debit'],
    credit_columns: ['Credit'],
  },
  bank_of_america: {
    date_columns: ['Date', 'Posted Date'],
    description_columns: ['Description', 'Payee'],
    amount_columns: ['Amount'],
    debit_columns: [],
    credit_columns: [],
  },
  wells_fargo: {
    date_columns: ['Date'],
    description_columns: ['Description'],
    amount_columns: ['Amount'],
    debit_columns: [],
    credit_columns: [],
  },
  generic: {
    date_columns: ['Date', 'Trans Date', 'Transaction Date', 'Posted', 'Post Date'],
    description_columns: ['Description', 'Memo', 'Details', 'Payee', 'Name', 'Merchant'],
    amount_columns: ['Amount', 'Total', 'Value'],
    debit_columns: ['Debit', 'Withdrawal', 'Withdrawals', 'Outflow'],
    credit_columns: ['Credit', 'Deposit', 'Deposits', 'Inflow'],
  },
};

function detectBankFromCsv(headers: string[]): string {
  const headersLower = headers.map((h) => h.toLowerCase());
  if (headersLower.some((h) => h.includes('chase'))) return 'chase';
  if (headersLower.some((h) => h.includes('bank of america') || h.includes('bofa'))) return 'bank_of_america';
  if (headersLower.some((h) => h.includes('wells fargo'))) return 'wells_fargo';
  return 'generic';
}

function findColumn(headers: string[], possibleNames: string[]): number | null {
  const headersLower = headers.map((h) => h.toLowerCase().trim());
  for (const name of possibleNames) {
    const idx = headersLower.indexOf(name.toLowerCase());
    if (idx !== -1) return idx;
  }
  return null;
}

function autoDetectCsvColumns(rows: string[][]): Record<string, number> {
  if (rows.length < 2) return {};

  const numCols = Math.max(...rows.map((r) => r.length));
  const colAnalysis: Record<
    number,
    { dateCount: number; amountCount: number; textCount: number; hasNegative: boolean; hasPositive: boolean }
  > = {};

  for (let i = 0; i < numCols; i++) {
    colAnalysis[i] = { dateCount: 0, amountCount: 0, textCount: 0, hasNegative: false, hasPositive: false };
  }

  for (const row of rows.slice(0, 20)) {
    for (let i = 0; i < row.length; i++) {
      if (i >= numCols) continue;
      const cell = row[i].trim();
      if (!cell) continue;

      if (tryParseDate(cell)) {
        colAnalysis[i].dateCount++;
      } else if (/^["']?-?\s*\$?\s*[\d,]+\.?\d*["']?$/.test(cell.replace(/,/g, '').replace(/"/g, '').replace(/'/g, '').trim())) {
        colAnalysis[i].amountCount++;
        if (cell.includes('-')) colAnalysis[i].hasNegative = true;
        else {
          const c = cell.replace(/["\',\s$]/g, '');
          if (c && /^\d/.test(c)) colAnalysis[i].hasPositive = true;
        }
      } else {
        colAnalysis[i].textCount++;
      }
    }
  }

  const detected: Record<string, number> = {};

  // Find date column
  const dateCandidates = Object.entries(colAnalysis)
    .filter(([, c]) => c.dateCount > 0)
    .sort((a, b) => b[1].dateCount - a[1].dateCount);
  if (dateCandidates.length > 0) detected.date = parseInt(dateCandidates[0][0], 10);

  // Find amount column (prefer one with both positive and negative)
  const amountCandidates = Object.entries(colAnalysis)
    .filter(([, c]) => c.amountCount > 0)
    .sort((a, b) => {
      const scoreA = (a[1].hasNegative && a[1].hasPositive ? 10 : 0) + (a[1].hasNegative ? 5 : 0) + a[1].amountCount;
      const scoreB = (b[1].hasNegative && b[1].hasPositive ? 10 : 0) + (b[1].hasNegative ? 5 : 0) + b[1].amountCount;
      return scoreB - scoreA;
    });
  if (amountCandidates.length > 0) detected.amount = parseInt(amountCandidates[0][0], 10);

  // Find description column (most text, not already used)
  const usedCols = new Set(Object.values(detected));
  const descCandidates = Object.entries(colAnalysis)
    .filter(([idx, c]) => c.textCount > 0 && !usedCols.has(parseInt(idx, 10)))
    .sort((a, b) => b[1].textCount - a[1].textCount);
  if (descCandidates.length > 0) detected.description = parseInt(descCandidates[0][0], 10);

  return detected;
}

function parseCsvContent(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === ',' || ch === '\t') && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }

  return rows;
}

export function parseCsvStatement(content: string): StatementParseResult {
  const result: StatementParseResult = {
    transactions: [],
    errors: [],
    warnings: [],
    parser_used: 'csv',
  };

  try {
    // Detect delimiter from sample
    const sample = content.slice(0, 2000);
    const useTab = sample.includes('\t') && (sample.match(/\t/g) || []).length > (sample.match(/,/g) || []).length;

    const rows = parseCsvContent(useTab ? content.replace(/\t/g, ',') : content);

    if (rows.length < 2) {
      result.errors.push('CSV file appears to be empty or has no data rows');
      return result;
    }

    // Find header row
    let headerIdx = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some((cell) => cell.trim())) {
        headerIdx = i;
        break;
      }
    }

    const firstRow = rows[headerIdx].map((h) => h.trim());

    // Check if first row is headers or data
    let firstRowIsData = false;
    for (const cell of firstRow) {
      if (tryParseDate(cell)) {
        firstRowIsData = true;
        break;
      }
      const c = cell.replace(/["\',\s$]/g, '');
      if (/^-?\d+\.?\d*$/.test(c)) {
        firstRowIsData = true;
        break;
      }
    }

    let headers: string[] = [];
    let dataRows: string[][];

    if (firstRowIsData) {
      dataRows = rows.slice(headerIdx);
      result.warnings.push('No header row detected - using auto-detection');
    } else {
      headers = firstRow;
      dataRows = rows.slice(headerIdx + 1);
    }

    result.headers_detected = headers.length > 0 ? headers : ['(no headers - auto-detected)'];
    result.sample_lines = dataRows.slice(0, 3).map((r) => JSON.stringify(r));

    let dateCol: number | null = null;
    let descCol: number | null = null;
    let amountCol: number | null = null;
    let debitCol: number | null = null;
    let creditCol: number | null = null;

    // Header-based detection
    if (headers.length > 0) {
      const bank = detectBankFromCsv(headers);
      result.bank_detected = bank;
      const config = BANK_CONFIGS[bank] || BANK_CONFIGS.generic;

      dateCol = findColumn(headers, config.date_columns);
      descCol = findColumn(headers, config.description_columns);
      amountCol = findColumn(headers, config.amount_columns);
      debitCol = findColumn(headers, config.debit_columns);
      creditCol = findColumn(headers, config.credit_columns);
    }

    // Auto-detect fallback
    if (dateCol === null || descCol === null || (amountCol === null && debitCol === null && creditCol === null)) {
      const auto = autoDetectCsvColumns(dataRows);
      result.bank_detected = 'auto-detected';
      if (auto.date !== undefined && dateCol === null) dateCol = auto.date;
      if (auto.description !== undefined && descCol === null) descCol = auto.description;
      if (auto.amount !== undefined && amountCol === null) amountCol = auto.amount;
    }

    if (dateCol === null) {
      result.errors.push(`Could not find date column. Headers: ${JSON.stringify(headers)}`);
      return result;
    }

    // Set date format hint
    setDateFormatHint(dataRows, dateCol);

    if (descCol === null) {
      for (let i = 0; i < (headers.length || (dataRows[0]?.length || 0)); i++) {
        if (i !== dateCol && i !== amountCol && i !== debitCol && i !== creditCol) {
          descCol = i;
          break;
        }
      }
    }
    if (descCol === null) {
      result.errors.push(`Could not find description column. Headers: ${JSON.stringify(headers)}`);
      return result;
    }
    if (amountCol === null && debitCol === null && creditCol === null) {
      result.errors.push(`Could not find amount column. Headers: ${JSON.stringify(headers)}`);
      return result;
    }

    // Parse each row
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      try {
        const maxCol = Math.max(
          ...[dateCol, descCol, amountCol, debitCol, creditCol].filter((c): c is number => c !== null),
        );
        if (row.length <= maxCol) continue;

        const date = tryParseDate(row[dateCol]);
        if (!date) continue;

        const description = descCol !== null && descCol < row.length ? row[descCol].trim() : '';
        if (!description) continue;

        let amount: number | null = null;
        if (amountCol !== null && amountCol < row.length && row[amountCol].trim()) {
          amount = parseAmount(row[amountCol]);
        } else if (debitCol !== null || creditCol !== null) {
          let debit: number | null = null;
          let credit: number | null = null;
          if (debitCol !== null && debitCol < row.length && row[debitCol].trim()) {
            debit = parseAmount(row[debitCol]);
          }
          if (creditCol !== null && creditCol < row.length && row[creditCol].trim()) {
            credit = parseAmount(row[creditCol]);
          }
          if (debit !== null && debit !== 0) amount = -Math.abs(debit);
          else if (credit !== null && credit !== 0) amount = Math.abs(credit);
        }

        if (amount === null || amount === 0) continue;

        result.transactions.push({
          date: formatDate(date),
          description,
          amount,
          confidence: 1.0,
          raw_data: { row: rowIdx + headerIdx + 2, original: row },
        });
      } catch (e) {
        result.warnings.push(`Row ${rowIdx + headerIdx + 2}: Error - ${String(e)}`);
      }
    }

    if (result.transactions.length === 0) {
      result.errors.push(
        `No valid transactions found. Detected columns - Date: ${dateCol}, Desc: ${descCol}, Amount: ${amountCol}`,
      );
    }
  } catch (e) {
    result.errors.push(`Error parsing CSV: ${String(e)}`);
  }

  return result;
}

// ============================================
// OFX/QFX Parser
// ============================================

export function parseOfxStatement(content: string): StatementParseResult {
  const result: StatementParseResult = {
    transactions: [],
    errors: [],
    warnings: [],
    parser_used: 'ofx',
  };

  try {
    // Find STMTTRN blocks
    const txnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
    let matches = [...content.matchAll(txnRegex)];

    if (matches.length === 0) {
      // Try without closing tags
      const altRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
      matches = [...content.matchAll(altRegex)];
    }

    if (matches.length === 0) {
      result.errors.push('No transactions found in OFX file');
      return result;
    }

    // Extract bank info
    const bankMatch = /<ORG>([^<\n]+)/i.exec(content);
    if (bankMatch) result.bank_detected = bankMatch[1].trim();

    const acctMatch = /<ACCTID>([^<\n]+)/i.exec(content);
    if (acctMatch) result.account_info = `Account: ***${acctMatch[1].trim().slice(-4)}`;

    for (const match of matches) {
      const txnContent = match[1];

      const getField = (name: string): string | null => {
        const regex = new RegExp(`<${name}>([^<\\n]+)`, 'i');
        const m = regex.exec(txnContent);
        return m ? m[1].trim() : null;
      };

      const dateStr = getField('DTPOSTED');
      if (!dateStr) continue;

      let date: Date;
      try {
        if (dateStr.length >= 8) {
          const y = parseInt(dateStr.slice(0, 4), 10);
          const m = parseInt(dateStr.slice(4, 6), 10) - 1;
          const d = parseInt(dateStr.slice(6, 8), 10);
          date = new Date(y, m, d);
          if (isNaN(date.getTime())) continue;
        } else {
          continue;
        }
      } catch {
        continue;
      }

      const amountStr = getField('TRNAMT');
      if (!amountStr) continue;
      const amount = parseAmount(amountStr);
      if (amount === null) continue;

      const description = getField('NAME') || getField('MEMO') || 'Unknown';

      result.transactions.push({
        date: formatDate(date),
        description,
        amount,
        confidence: 1.0,
        raw_data: { ofx_content: txnContent },
      });
    }

    if (result.transactions.length === 0) {
      result.errors.push('No valid transactions parsed from OFX');
    }
  } catch (e) {
    result.errors.push(`Error parsing OFX: ${String(e)}`);
  }

  return result;
}

// ============================================
// File Type Detection
// ============================================

export function detectFileType(filename: string, content: Buffer): string {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.ofx')) return 'application/x-ofx';
  if (lower.endsWith('.qfx')) return 'application/x-qfx';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';

  // Check magic bytes
  if (content[0] === 0x25 && content[1] === 0x50 && content[2] === 0x44 && content[3] === 0x46) return 'application/pdf';
  if (content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4e && content[3] === 0x47) return 'image/png';
  if (content[0] === 0xff && content[1] === 0xd8) return 'image/jpeg';

  // Check for OFX content
  const textSample = content.subarray(0, 1000).toString('utf-8');
  if (textSample.toUpperCase().includes('<OFX>') || textSample.toUpperCase().includes('OFXHEADER')) {
    return 'application/x-ofx';
  }

  return 'text/csv';
}

// ============================================
// Main Entry Point
// ============================================

export function parseStatement(filename: string, content: Buffer): StatementParseResult {
  const fileType = detectFileType(filename, content);

  if (fileType === 'text/csv') {
    const text = content.toString('utf-8');
    return parseCsvStatement(text);
  }

  if (fileType === 'application/x-ofx' || fileType === 'application/x-qfx') {
    const text = content.toString('utf-8');
    return parseOfxStatement(text);
  }

  if (fileType === 'application/pdf') {
    return {
      transactions: [],
      errors: ['PDF parsing requires AI vision. Please configure an AI provider that supports vision in Settings.'],
      warnings: [],
      parser_used: 'pdf',
    };
  }

  if (fileType.startsWith('image/')) {
    return {
      transactions: [],
      errors: ['Image parsing requires AI vision. Please configure an AI provider that supports vision in Settings.'],
      warnings: [],
      parser_used: 'image',
    };
  }

  return {
    transactions: [],
    errors: [`Unsupported file type: ${fileType}`],
    warnings: [],
    parser_used: 'unknown',
  };
}
