"""
Bank Statement Parser - Supports CSV, OFX/QFX, PDF, and images.
Uses hybrid approach: rule-based parsing with AI fallback.
"""
import csv
import io
import re
import base64
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ParsedTransaction:
    """Represents a parsed transaction from a statement."""
    date: datetime
    description: str
    amount: float
    merchant: Optional[str] = None
    category_suggestion: Optional[str] = None
    confidence: float = 1.0
    raw_data: Optional[Dict] = None


class StatementParseResult:
    """Result of parsing a bank statement."""
    def __init__(self):
        self.transactions: List[ParsedTransaction] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.bank_detected: Optional[str] = None
        self.account_info: Optional[str] = None
        self.parser_used: str = "unknown"
        self.headers_detected: Optional[List[str]] = None
        self.sample_lines: Optional[List[str]] = None


# Common date formats used by banks
# Order matters - more specific/common formats first
DATE_FORMATS_DMY = [  # European format (DD/MM/YYYY) - try first
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d/%m/%y",
    "%d-%m-%y",
]

DATE_FORMATS_MDY = [  # American format (MM/DD/YYYY)
    "%m/%d/%Y",
    "%m/%d/%y",
    "%m-%d-%Y",
]

DATE_FORMATS_OTHER = [  # Unambiguous formats
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%b %d, %Y",
    "%B %d, %Y",
    "%d %b %Y",
    "%d %B %Y",
]

# Module-level cache for detected date format preference
_detected_date_format: Optional[str] = None


def detect_date_format(date_strings: List[str]) -> str:
    """
    Detect whether dates are DD/MM/YYYY or MM/DD/YYYY by looking for
    values > 12 in the first position (must be day) or second position (must be day).
    """
    for date_str in date_strings:
        date_str = date_str.strip()
        # Look for dates with / or - separator
        parts = re.split(r'[/\-.]', date_str)
        if len(parts) >= 2:
            try:
                first = int(parts[0])
                second = int(parts[1])
                # If first part > 12, it must be a day (DD/MM format)
                if first > 12:
                    return "DMY"
                # If second part > 12, it must be a day (MM/DD format)
                if second > 12:
                    return "MDY"
            except ValueError:
                continue
    # Default to European format (more common globally)
    return "DMY"


def parse_date(date_str: str, format_hint: Optional[str] = None) -> Optional[datetime]:
    """Try to parse a date string using common formats."""
    global _detected_date_format

    date_str = date_str.strip()
    if not date_str:
        return None

    # Determine format order based on hint or detection
    hint = format_hint or _detected_date_format or "DMY"

    if hint == "DMY":
        formats_to_try = DATE_FORMATS_DMY + DATE_FORMATS_OTHER + DATE_FORMATS_MDY
    else:
        formats_to_try = DATE_FORMATS_MDY + DATE_FORMATS_OTHER + DATE_FORMATS_DMY

    for fmt in formats_to_try:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def set_date_format_hint(rows: List[List[str]], date_col: int):
    """Analyze dates in data to set the format hint."""
    global _detected_date_format
    date_strings = []
    for row in rows[:20]:
        if date_col < len(row):
            date_strings.append(row[date_col])
    _detected_date_format = detect_date_format(date_strings)


def parse_amount(amount_str: str, default_negative: bool = False) -> Optional[float]:
    """
    Parse an amount string, handling various formats.

    Convention:
    - "-" prefix = expense (negative)
    - No sign = income (positive), unless default_negative is True
    - Parentheses = negative (accounting format)
    - "DR" suffix = negative (debit)
    - "CR" suffix = positive (credit)
    """
    if not amount_str:
        return None

    # Remove whitespace
    cleaned = amount_str.strip()
    if not cleaned:
        return None

    # Track if we found an explicit negative sign
    is_negative = False

    # Check for explicit negative sign at start (before or after currency symbol)
    if cleaned.startswith('-') or cleaned.startswith('- '):
        is_negative = True
        cleaned = cleaned.lstrip('- ')
    elif cleaned.startswith('+'):
        is_negative = False
        cleaned = cleaned[1:]

    # Remove currency symbols (but check for negative after $ like $-50)
    if '$-' in cleaned or '$ -' in cleaned:
        is_negative = True
    cleaned = re.sub(r'[$£€¥₹₿]', '', cleaned)

    # Check again for negative after removing currency
    cleaned = cleaned.strip()
    if cleaned.startswith('-'):
        is_negative = True
        cleaned = cleaned[1:]

    cleaned = cleaned.replace(',', '')
    cleaned = cleaned.replace(' ', '')

    # Handle parentheses for negative numbers (accounting format)
    if cleaned.startswith('(') and cleaned.endswith(')'):
        is_negative = True
        cleaned = cleaned[1:-1]

    # Handle CR/DR suffixes
    if cleaned.upper().endswith('CR'):
        is_negative = False  # Credit = positive (income)
        cleaned = cleaned[:-2]
    elif cleaned.upper().endswith('DR'):
        is_negative = True  # Debit = negative (expense)
        cleaned = cleaned[:-2]

    try:
        value = float(cleaned)
        return -abs(value) if is_negative else abs(value)
    except ValueError:
        return None


# ============================================
# CSV Parser
# ============================================

# Bank-specific CSV configurations
BANK_CONFIGS = {
    "chase": {
        "date_columns": ["Transaction Date", "Posting Date", "Date"],
        "description_columns": ["Description", "Merchant"],
        "amount_columns": ["Amount"],
        "debit_columns": ["Debit"],
        "credit_columns": ["Credit"],
    },
    "bank_of_america": {
        "date_columns": ["Date", "Posted Date"],
        "description_columns": ["Description", "Payee"],
        "amount_columns": ["Amount"],
        "debit_columns": [],
        "credit_columns": [],
    },
    "wells_fargo": {
        "date_columns": ["Date"],
        "description_columns": ["Description"],
        "amount_columns": ["Amount"],
        "debit_columns": [],
        "credit_columns": [],
    },
    "generic": {
        "date_columns": ["Date", "Trans Date", "Transaction Date", "Posted", "Post Date"],
        "description_columns": ["Description", "Memo", "Details", "Payee", "Name", "Merchant"],
        "amount_columns": ["Amount", "Total", "Value"],
        "debit_columns": ["Debit", "Withdrawal", "Withdrawals", "Outflow"],
        "credit_columns": ["Credit", "Deposit", "Deposits", "Inflow"],
    },
}


def detect_bank_from_csv(headers: List[str]) -> str:
    """Detect which bank format based on CSV headers."""
    headers_lower = [h.lower() for h in headers]

    # Check for bank-specific patterns
    if any("chase" in h for h in headers_lower):
        return "chase"
    if any("bank of america" in h or "bofa" in h for h in headers_lower):
        return "bank_of_america"
    if any("wells fargo" in h for h in headers_lower):
        return "wells_fargo"

    return "generic"


def find_column(headers: List[str], possible_names: List[str]) -> Optional[int]:
    """Find the index of a column by trying multiple possible names."""
    headers_lower = [h.lower().strip() for h in headers]
    for name in possible_names:
        if name.lower() in headers_lower:
            return headers_lower.index(name.lower())
    return None


def auto_detect_csv_columns(rows: List[List[str]]) -> Dict[str, int]:
    """
    Auto-detect which columns contain dates, amounts, and descriptions
    by analyzing the actual data content.
    """
    if len(rows) < 2:
        return {}

    num_cols = max(len(row) for row in rows)
    col_analysis = {i: {
        "date_count": 0,
        "amount_count": 0,
        "text_count": 0,
        "has_negative": False,
        "has_positive": False,
        "samples": []
    } for i in range(num_cols)}

    # Analyze first 20 data rows
    for row in rows[:20]:
        for i, cell in enumerate(row):
            if i >= num_cols:
                continue
            cell = cell.strip()
            if not cell:
                continue

            col_analysis[i]["samples"].append(cell[:50])

            # Check if it looks like a date
            if parse_date(cell):
                col_analysis[i]["date_count"] += 1
            # Check if it looks like an amount (including negative amounts with -)
            elif re.search(r'^["\']?-?\s*\$?\s*[\d,]+\.?\d*["\']?$', cell.replace(',', '').replace('"', '').replace("'", '').strip()):
                col_analysis[i]["amount_count"] += 1
                # Track if this column has negative values
                if '-' in cell:
                    col_analysis[i]["has_negative"] = True
                else:
                    # Check if it's a positive number
                    cleaned = re.sub(r'["\',\s$]', '', cell)
                    if cleaned and cleaned[0].isdigit():
                        col_analysis[i]["has_positive"] = True
            else:
                col_analysis[i]["text_count"] += 1

    # Determine column types
    detected = {}

    # Find date column (highest date count)
    date_candidates = [(i, c["date_count"]) for i, c in col_analysis.items() if c["date_count"] > 0]
    if date_candidates:
        date_candidates.sort(key=lambda x: x[1], reverse=True)
        detected["date"] = date_candidates[0][0]

    # Find amount columns
    # Prefer columns that have BOTH positive and negative values (transaction amounts)
    # over columns that only have positive values (likely balance column)
    amount_candidates = [(i, c) for i, c in col_analysis.items() if c["amount_count"] > 0]

    # Sort by: has both signs > has negative > amount count
    def amount_score(item):
        i, c = item
        has_both = c["has_negative"] and c["has_positive"]
        return (has_both, c["has_negative"], c["amount_count"])

    amount_candidates.sort(key=amount_score, reverse=True)

    if amount_candidates:
        # Use the column that has both positive and negative (transaction amounts)
        # not the balance column (usually only positive)
        best_col = amount_candidates[0][0]
        detected["amount"] = best_col

    # Find description column (most text, not already used)
    used_cols = set(detected.values())
    desc_candidates = [(i, c["text_count"]) for i, c in col_analysis.items()
                       if c["text_count"] > 0 and i not in used_cols]
    if desc_candidates:
        desc_candidates.sort(key=lambda x: x[1], reverse=True)
        detected["description"] = desc_candidates[0][0]

    return detected


def parse_csv_statement(content: str) -> StatementParseResult:
    """Parse a CSV bank statement with auto-detection of columns."""
    result = StatementParseResult()
    result.parser_used = "csv"

    try:
        # Try to detect delimiter
        sample = content[:2000]
        if '\t' in sample and sample.count('\t') > sample.count(','):
            delimiter = '\t'
        else:
            delimiter = ','

        reader = csv.reader(io.StringIO(content), delimiter=delimiter)
        rows = list(reader)

        if len(rows) < 2:
            result.errors.append("CSV file appears to be empty or has no data rows")
            return result

        # Find header row (first non-empty row)
        header_idx = 0
        for i, row in enumerate(rows):
            if any(cell.strip() for cell in row):
                header_idx = i
                break

        first_row = [h.strip() for h in rows[header_idx]]

        # Check if first row looks like headers or data
        # If it contains dates or amounts, it's probably data, not headers
        first_row_is_data = False
        for cell in first_row:
            if parse_date(cell):
                first_row_is_data = True
                break
            # Check if it looks like an amount
            cleaned = re.sub(r'["\',\s$]', '', cell)
            if re.match(r'^-?\d+\.?\d*$', cleaned):
                first_row_is_data = True
                break

        if first_row_is_data:
            # No header row - all rows are data
            headers = []
            data_rows = rows[header_idx:]
            result.warnings.append("No header row detected - using auto-detection")
        else:
            headers = first_row
            data_rows = rows[header_idx + 1:]

        # Store headers for debugging
        result.headers_detected = headers if headers else ["(no headers - auto-detected)"]
        result.sample_lines = [str(r) for r in data_rows[:3]]

        date_col = None
        desc_col = None
        amount_col = None
        debit_col = None
        credit_col = None

        # First try header-based detection (only if we have headers)
        if headers:
            bank = detect_bank_from_csv(headers)
            result.bank_detected = bank
            config = BANK_CONFIGS.get(bank, BANK_CONFIGS["generic"])

            # Find column indices using headers
            date_col = find_column(headers, config["date_columns"])
            desc_col = find_column(headers, config["description_columns"])
            amount_col = find_column(headers, config["amount_columns"])
            debit_col = find_column(headers, config["debit_columns"])
            credit_col = find_column(headers, config["credit_columns"])

        # If header detection failed or no headers, try auto-detection
        if date_col is None or (desc_col is None) or (amount_col is None and debit_col is None and credit_col is None):
            auto_detected = auto_detect_csv_columns(data_rows)
            result.bank_detected = "auto-detected"

            if "date" in auto_detected and date_col is None:
                date_col = auto_detected["date"]
            if "description" in auto_detected and desc_col is None:
                desc_col = auto_detected["description"]
            if "amount" in auto_detected and amount_col is None:
                amount_col = auto_detected["amount"]
            if "debit" in auto_detected and debit_col is None:
                debit_col = auto_detected["debit"]
            if "credit" in auto_detected and credit_col is None:
                credit_col = auto_detected["credit"]

        # Still couldn't find required columns
        if date_col is None:
            result.errors.append(f"Could not find date column. Headers: {headers}")
            return result

        # Detect date format (DD/MM vs MM/DD) based on the data
        set_date_format_hint(data_rows, date_col)
        if desc_col is None:
            # Try to use any text column
            for i, h in enumerate(headers):
                if i != date_col and i != amount_col and i != debit_col and i != credit_col:
                    desc_col = i
                    break
        if desc_col is None:
            result.errors.append(f"Could not find description column. Headers: {headers}")
            return result
        if amount_col is None and debit_col is None and credit_col is None:
            result.errors.append(f"Could not find amount column. Headers: {headers}")
            return result

        # Parse rows
        for row_num, row in enumerate(data_rows, start=header_idx + 2):
            try:
                max_col = max(filter(lambda x: x is not None, [date_col, desc_col, amount_col, debit_col, credit_col]))
                if len(row) <= max_col:
                    continue

                # Parse date
                date = parse_date(row[date_col])
                if not date:
                    continue

                # Parse description
                description = row[desc_col].strip() if desc_col is not None and desc_col < len(row) else ""
                if not description:
                    continue

                # Parse amount
                amount = None
                if amount_col is not None and amount_col < len(row) and row[amount_col].strip():
                    amount = parse_amount(row[amount_col])
                elif debit_col is not None or credit_col is not None:
                    debit = None
                    credit = None
                    if debit_col is not None and debit_col < len(row) and row[debit_col].strip():
                        debit = parse_amount(row[debit_col])
                    if credit_col is not None and credit_col < len(row) and row[credit_col].strip():
                        credit = parse_amount(row[credit_col])

                    if debit is not None and debit != 0:
                        amount = -abs(debit)
                    elif credit is not None and credit != 0:
                        amount = abs(credit)

                if amount is None or amount == 0:
                    continue

                txn = ParsedTransaction(
                    date=date,
                    description=description,
                    amount=amount,
                    raw_data={"row": row_num, "original": row},
                )
                result.transactions.append(txn)

            except Exception as e:
                result.warnings.append(f"Row {row_num}: Error - {str(e)}")

        if not result.transactions:
            result.errors.append(f"No valid transactions found. Detected columns - Date: {date_col}, Desc: {desc_col}, Amount: {amount_col}")

    except Exception as e:
        result.errors.append(f"Error parsing CSV: {str(e)}")

    return result


# ============================================
# OFX/QFX Parser
# ============================================

def parse_ofx_statement(content: str) -> StatementParseResult:
    """Parse an OFX/QFX bank statement."""
    result = StatementParseResult()
    result.parser_used = "ofx"

    try:
        # OFX is SGML-like, not proper XML
        # Find all STMTTRN (statement transaction) blocks
        txn_pattern = re.compile(r'<STMTTRN>(.*?)</STMTTRN>', re.DOTALL | re.IGNORECASE)
        matches = txn_pattern.findall(content)

        if not matches:
            # Try without closing tags (some OFX files don't have them)
            txn_pattern = re.compile(r'<STMTTRN>(.*?)(?=<STMTTRN>|</BANKTRANLIST>|$)', re.DOTALL | re.IGNORECASE)
            matches = txn_pattern.findall(content)

        if not matches:
            result.errors.append("No transactions found in OFX file")
            return result

        # Extract bank info
        bank_match = re.search(r'<ORG>([^<\n]+)', content)
        if bank_match:
            result.bank_detected = bank_match.group(1).strip()

        acct_match = re.search(r'<ACCTID>([^<\n]+)', content)
        if acct_match:
            result.account_info = f"Account: ***{acct_match.group(1).strip()[-4:]}"

        for txn_content in matches:
            # Extract fields
            def get_field(name: str) -> Optional[str]:
                pattern = re.compile(f'<{name}>([^<\\n]+)', re.IGNORECASE)
                match = pattern.search(txn_content)
                return match.group(1).strip() if match else None

            # Parse date (YYYYMMDD or YYYYMMDDHHMMSS format)
            date_str = get_field('DTPOSTED')
            if not date_str:
                continue

            try:
                if len(date_str) >= 8:
                    date = datetime.strptime(date_str[:8], '%Y%m%d')
                else:
                    continue
            except ValueError:
                continue

            # Parse amount
            amount_str = get_field('TRNAMT')
            if not amount_str:
                continue
            amount = parse_amount(amount_str)
            if amount is None:
                continue

            # Parse description (NAME or MEMO)
            description = get_field('NAME') or get_field('MEMO') or "Unknown"

            txn = ParsedTransaction(
                date=date,
                description=description,
                amount=amount,
                raw_data={"ofx_content": txn_content},
            )
            result.transactions.append(txn)

        if not result.transactions:
            result.errors.append("No valid transactions parsed from OFX")

    except Exception as e:
        result.errors.append(f"Error parsing OFX: {str(e)}")

    return result


# ============================================
# AI-Powered Parser (PDF, Images)
# ============================================

def convert_pdf_to_images(file_content: bytes) -> List[bytes]:
    """Convert PDF pages to PNG images using PyMuPDF."""
    try:
        import fitz  # PyMuPDF

        images = []
        pdf_document = fitz.open(stream=file_content, filetype="pdf")

        # Convert each page to an image (limit to first 5 pages for performance)
        for page_num in range(min(len(pdf_document), 5)):
            page = pdf_document[page_num]
            # Render at 2x resolution for better OCR
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat)
            images.append(pix.tobytes("png"))

        pdf_document.close()
        return images
    except ImportError:
        return []
    except Exception as e:
        print(f"PDF conversion error: {e}")
        return []


def extract_pdf_text(file_content: bytes) -> str:
    """Extract text content from a PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF

        pdf_document = fitz.open(stream=file_content, filetype="pdf")
        full_text = ""

        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            full_text += page.get_text() + "\n"

        pdf_document.close()
        return full_text
    except ImportError:
        return ""
    except Exception as e:
        print(f"PDF text extraction error: {e}")
        return ""


def parse_pdf_text(text: str) -> StatementParseResult:
    """
    Parse transaction data from extracted PDF text.
    Uses flexible pattern matching to find dates, descriptions, and amounts.
    """
    result = StatementParseResult()
    result.parser_used = "pdf_text"

    if not text.strip():
        result.errors.append("No text could be extracted from PDF")
        return result

    lines = text.split('\n')
    result.sample_lines = [l[:100] for l in lines[:10] if l.strip()]

    # Look for lines that contain both a date and an amount
    date_pattern = re.compile(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})')
    # Match amounts with optional negative sign, currency symbol, and optional decimals
    # Matches: -$1,234.56, $1234, -1234.5, 1234, etc.
    amount_pattern = re.compile(r'(-?\s*\$?\s*[\d,]+(?:\.\d{1,2})?)\b')

    seen_transactions = set()  # Avoid duplicates

    for line_num, line in enumerate(lines):
        line = line.strip()
        if not line or len(line) < 10:
            continue

        # Find date in line
        date_match = date_pattern.search(line)
        if not date_match:
            continue

        date_str = date_match.group(1)
        date = parse_date(date_str)
        if not date:
            continue

        # Find amounts in line (there might be multiple - balance, amount, etc.)
        amount_matches = amount_pattern.findall(line)
        if not amount_matches:
            continue

        # Usually the transaction amount is the first or last amount on the line
        # Try the last one first (often the transaction amount comes after balance)
        amount = None
        for amt_str in reversed(amount_matches):
            parsed = parse_amount(amt_str)
            if parsed is not None and parsed != 0:
                amount = parsed
                break

        if amount is None:
            continue

        # Extract description (everything between date and amount, roughly)
        # Remove the date and amounts to get description
        description = line
        description = date_pattern.sub('', description, count=1)  # Remove first date
        for amt_str in amount_matches:
            description = description.replace(amt_str, '', 1)
        description = re.sub(r'\s+', ' ', description).strip()

        # Clean up description - remove common noise
        description = re.sub(r'^[\s\-\*\|]+', '', description)
        description = re.sub(r'[\s\-\*\|]+$', '', description)

        # Skip if description is too short or looks like a header/summary
        if len(description) < 3:
            continue
        skip_words = ['date', 'description', 'amount', 'balance', 'total', 'beginning', 'ending', 'statement', 'period']
        if any(word in description.lower() for word in skip_words):
            continue

        # Skip if this looks like a balance line
        if 'balance' in line.lower():
            continue

        # Create unique key to avoid duplicates
        txn_key = (date.strftime('%Y-%m-%d'), description[:30], round(amount, 2))
        if txn_key in seen_transactions:
            continue
        seen_transactions.add(txn_key)

        txn = ParsedTransaction(
            date=date,
            description=description,
            amount=amount,
            confidence=0.7,  # Text extraction confidence
        )
        result.transactions.append(txn)

    if not result.transactions:
        result.warnings.append("No transactions could be parsed from PDF text. Sample lines: " + str(result.sample_lines[:3]))

    return result


def parse_pdf_statement(file_content: bytes, api_key: Optional[str] = None) -> StatementParseResult:
    """
    Parse a PDF bank statement.
    First tries text extraction, falls back to AI if available and needed.
    """
    # Try text extraction first (works for most digital PDFs)
    text = extract_pdf_text(file_content)

    if text and len(text.strip()) > 100:
        result = parse_pdf_text(text)

        # If we found transactions, return them
        if result.transactions:
            return result

        # If text extraction worked but no transactions found, try AI if available
        if api_key:
            result.warnings.append("Text extraction found no transactions, trying AI...")
            ai_result = parse_with_ai(file_content, 'application/pdf', api_key)
            return ai_result
        else:
            result.errors.append(
                "Could not parse transactions from PDF text. "
                "Enable AI (OpenAI) in Settings for better PDF parsing of scanned documents."
            )
            return result

    # No text extracted - likely a scanned PDF
    if api_key:
        return parse_with_ai(file_content, 'application/pdf', api_key)
    else:
        result = StatementParseResult()
        result.errors.append(
            "This PDF appears to be scanned/image-based. "
            "Enable AI (OpenAI) in Settings to parse scanned PDFs."
        )
        return result


def parse_with_ai(
    file_content: bytes,
    file_type: str,
    api_key: str
) -> StatementParseResult:
    """
    Parse a PDF or image file using OpenAI Vision API.

    Args:
        file_content: Raw file bytes
        file_type: MIME type (application/pdf, image/png, image/jpeg, etc.)
        api_key: OpenAI API key
    """
    result = StatementParseResult()
    result.parser_used = "ai"

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Handle PDF files by converting to images first
        if file_type == 'application/pdf':
            pdf_images = convert_pdf_to_images(file_content)
            if not pdf_images:
                result.errors.append("Could not convert PDF to images. Please ensure the PDF is valid or try a screenshot.")
                return result

            # Process each page and combine transactions
            all_transactions = []
            for page_num, img_bytes in enumerate(pdf_images):
                page_result = parse_single_image(client, img_bytes, 'image/png')
                all_transactions.extend(page_result.transactions)
                result.warnings.extend(page_result.warnings)
                if page_result.errors:
                    result.warnings.append(f"Page {page_num + 1}: {'; '.join(page_result.errors)}")

            result.transactions = all_transactions
            if not result.transactions:
                result.errors.append("No transactions found in the PDF")
            return result

        # For images, process directly
        return parse_single_image(client, file_content, file_type)

    except ImportError:
        result.errors.append("OpenAI package not installed")
    except Exception as e:
        result.errors.append(f"AI parsing error: {str(e)}")

    return result


def parse_single_image(client, file_content: bytes, file_type: str) -> StatementParseResult:
    """Parse a single image using OpenAI Vision API."""
    result = StatementParseResult()
    result.parser_used = "ai"

    try:
        # Convert to base64
        base64_content = base64.b64encode(file_content).decode('utf-8')

        media_type = file_type
        if not media_type.startswith('image/'):
            media_type = 'image/png'  # Default assumption

        # Create prompt for transaction extraction
        prompt = """Analyze this bank statement image and extract all transactions.

For each transaction, provide:
- date: The transaction date (format: YYYY-MM-DD)
- description: The merchant or transaction description
- amount: The amount (positive for deposits/credits, negative for withdrawals/debits)

Return the data as a JSON array like this:
[
  {"date": "2024-01-15", "description": "AMAZON PURCHASE", "amount": -45.99},
  {"date": "2024-01-14", "description": "PAYROLL DEPOSIT", "amount": 2500.00}
]

Only return the JSON array, no other text. If you cannot read the statement clearly, return an empty array []."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{base64_content}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=4096,
            temperature=0.1,
        )

        response_text = response.choices[0].message.content.strip()

        # Try to parse JSON
        import json

        # Handle markdown code blocks
        if response_text.startswith('```'):
            # Extract JSON from code block
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                response_text = json_match.group(1)

        transactions_data = json.loads(response_text)

        for txn_data in transactions_data:
            try:
                date = datetime.strptime(txn_data['date'], '%Y-%m-%d')
                amount = float(txn_data['amount'])
                description = str(txn_data['description'])

                txn = ParsedTransaction(
                    date=date,
                    description=description,
                    amount=amount,
                    confidence=0.8,  # AI-extracted, slightly lower confidence
                )
                result.transactions.append(txn)
            except (KeyError, ValueError) as e:
                result.warnings.append(f"Could not parse AI-extracted transaction: {e}")

        if not result.transactions:
            result.warnings.append("AI could not extract any transactions from the image")

    except Exception as e:
        result.errors.append(f"AI parsing error: {str(e)}")

    return result


# ============================================
# Main Parser Entry Point
# ============================================

def detect_file_type(filename: str, content: bytes) -> str:
    """Detect file type from filename and content."""
    filename_lower = filename.lower()

    if filename_lower.endswith('.csv'):
        return 'text/csv'
    elif filename_lower.endswith('.ofx'):
        return 'application/x-ofx'
    elif filename_lower.endswith('.qfx'):
        return 'application/x-qfx'
    elif filename_lower.endswith('.pdf'):
        return 'application/pdf'
    elif filename_lower.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
        if filename_lower.endswith('.png'):
            return 'image/png'
        elif filename_lower.endswith('.gif'):
            return 'image/gif'
        elif filename_lower.endswith('.webp'):
            return 'image/webp'
        else:
            return 'image/jpeg'

    # Check content magic bytes
    if content[:4] == b'%PDF':
        return 'application/pdf'
    if content[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if content[:2] == b'\xff\xd8':
        return 'image/jpeg'

    # Check for OFX content
    content_str = content[:1000].decode('utf-8', errors='ignore')
    if '<OFX>' in content_str.upper() or 'OFXHEADER' in content_str.upper():
        return 'application/x-ofx'

    # Default to CSV
    return 'text/csv'


def parse_statement(
    filename: str,
    content: bytes,
    openai_api_key: Optional[str] = None
) -> StatementParseResult:
    """
    Parse a bank statement file.

    Args:
        filename: Original filename
        content: Raw file content
        openai_api_key: Optional OpenAI API key for PDF/image parsing

    Returns:
        StatementParseResult with parsed transactions
    """
    file_type = detect_file_type(filename, content)

    if file_type == 'text/csv':
        text_content = content.decode('utf-8', errors='ignore')
        return parse_csv_statement(text_content)

    elif file_type in ('application/x-ofx', 'application/x-qfx'):
        text_content = content.decode('utf-8', errors='ignore')
        return parse_ofx_statement(text_content)

    elif file_type == 'application/pdf':
        # PDF: Try text extraction first, AI as fallback
        return parse_pdf_statement(content, openai_api_key)

    elif file_type in ('image/png', 'image/jpeg', 'image/gif', 'image/webp'):
        # Images always require AI
        if not openai_api_key:
            result = StatementParseResult()
            result.errors.append(
                "Image parsing requires an OpenAI API key. "
                "Please configure it in Settings."
            )
            return result
        return parse_with_ai(content, file_type, openai_api_key)

    else:
        result = StatementParseResult()
        result.errors.append(f"Unsupported file type: {file_type}")
        return result
