"""
Statement Upload API - Upload and parse bank statements.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_session
from models import Transaction, BudgetCategory
from services.statement_parser import parse_statement, ParsedTransaction
from services.categorizer import categorize_transaction
from services.ai_insights import ai_review_transactions, is_ai_available
from api.settings import get_setting_value

router = APIRouter(tags=["Statements"])


class ParsedTransactionResponse(BaseModel):
    """Response model for a parsed transaction."""
    index: int
    date: str
    description: str
    amount: float
    merchant: Optional[str] = None
    suggested_category_id: Optional[int] = None
    suggested_category_name: Optional[str] = None
    confidence: float = 1.0
    clean_description: Optional[str] = None  # AI-cleaned description
    ai_reviewed: bool = False  # Whether AI has reviewed this transaction


class StatementParseResponse(BaseModel):
    """Response model for statement parsing."""
    success: bool
    transactions: List[ParsedTransactionResponse]
    transaction_count: int
    errors: List[str]
    warnings: List[str]
    bank_detected: Optional[str] = None
    parser_used: str
    debug_info: Optional[dict] = None
    ai_enhanced: bool = False  # Whether AI was used to enhance categorization


class ImportTransactionRequest(BaseModel):
    """Request to import a transaction from parsed statement."""
    date: str
    description: str
    amount: float
    category_id: Optional[int] = None
    merchant: Optional[str] = None
    notes: Optional[str] = None


class BulkImportRequest(BaseModel):
    """Request to import multiple transactions."""
    transactions: List[ImportTransactionRequest]


@router.post("/budget/statements/parse")
async def parse_bank_statement(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
) -> StatementParseResponse:
    """
    Upload and parse a bank statement.

    Supports:
    - CSV files (most banks)
    - OFX/QFX files (Quicken format)
    - PDF files (requires OpenAI API key)
    - Images/screenshots (requires OpenAI API key)

    Returns parsed transactions for review before import.
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Read file content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Get OpenAI API key for PDF/image parsing
    openai_key = get_setting_value(session, "openai_api_key")

    # Parse the statement
    result = parse_statement(file.filename, content, openai_key)

    # Get categories for suggestion
    categories = session.exec(select(BudgetCategory)).all()
    category_map = {c.name.lower(): c for c in categories}
    category_id_map = {c.id: c for c in categories}

    # Prepare category info for AI
    category_list = [{"id": c.id, "name": c.name, "is_income": c.is_income} for c in categories]

    # Convert parsed transactions to dict format for AI review
    parsed_txns = [
        {
            "date": txn.date.strftime("%Y-%m-%d"),
            "description": txn.description,
            "amount": txn.amount,
            "merchant": txn.merchant,
        }
        for txn in result.transactions
    ]

    # Try AI review if API key is available
    ai_enhanced = False
    if openai_key and is_ai_available(openai_key):
        try:
            parsed_txns = ai_review_transactions(parsed_txns, category_list, openai_key)
            ai_enhanced = True
        except Exception as e:
            result.warnings.append(f"AI review failed, using rule-based categorization: {str(e)}")

    # Convert to response format
    transactions_response = []
    for i, txn in enumerate(parsed_txns):
        # Get AI-suggested category or fall back to rule-based
        cat_id = txn.get("suggested_category_id")
        cat_name = None
        confidence = 0.9 if txn.get("ai_reviewed") else 0.7

        if cat_id and cat_id in category_id_map:
            cat_name = category_id_map[cat_id].name
        elif not txn.get("ai_reviewed"):
            # Fall back to rule-based categorization
            cat_name, confidence = categorize_transaction(
                txn.get("description", ""),
                txn.get("merchant"),
                txn.get("amount", 0)
            )
            if cat_name:
                cat = category_map.get(cat_name.lower())
                if cat:
                    cat_id = cat.id

        transactions_response.append(ParsedTransactionResponse(
            index=i,
            date=txn.get("date", ""),
            description=txn.get("description", ""),
            amount=txn.get("amount", 0),
            merchant=txn.get("merchant"),
            suggested_category_id=cat_id,
            suggested_category_name=cat_name,
            confidence=confidence,
            clean_description=txn.get("clean_description"),
            ai_reviewed=txn.get("ai_reviewed", False),
        ))

    # Add debug info
    debug_info = {
        "filename": file.filename,
        "file_size": len(content),
        "parser_used": result.parser_used,
        "headers_detected": getattr(result, 'headers_detected', None),
        "sample_lines": getattr(result, 'sample_lines', None),
    }

    return StatementParseResponse(
        success=len(result.errors) == 0 and len(transactions_response) > 0,
        transactions=transactions_response,
        transaction_count=len(transactions_response),
        errors=result.errors,
        warnings=result.warnings,
        bank_detected=result.bank_detected,
        parser_used=result.parser_used,
        debug_info=debug_info,
        ai_enhanced=ai_enhanced,
    )


@router.post("/budget/statements/import")
def import_transactions(
    data: BulkImportRequest,
    session: Session = Depends(get_session)
):
    """
    Import parsed transactions into the database.

    Takes transactions that were parsed and reviewed by the user.
    """
    if not data.transactions:
        raise HTTPException(status_code=400, detail="No transactions to import")

    imported = []
    errors = []

    for i, txn_data in enumerate(data.transactions):
        try:
            # Parse date
            try:
                date = datetime.strptime(txn_data.date, "%Y-%m-%d")
            except ValueError:
                errors.append(f"Transaction {i}: Invalid date format")
                continue

            # Validate category if provided
            if txn_data.category_id:
                cat = session.get(BudgetCategory, txn_data.category_id)
                if not cat:
                    errors.append(f"Transaction {i}: Invalid category")
                    txn_data.category_id = None

            # Create transaction
            transaction = Transaction(
                date=date,
                description=txn_data.description,
                amount=txn_data.amount,
                category_id=txn_data.category_id,
                merchant=txn_data.merchant,
                notes=txn_data.notes or "Imported from statement",
            )
            session.add(transaction)
            imported.append({
                "description": txn_data.description,
                "amount": txn_data.amount,
                "date": txn_data.date,
            })

        except Exception as e:
            errors.append(f"Transaction {i}: {str(e)}")

    session.commit()

    return {
        "success": True,
        "imported_count": len(imported),
        "imported": imported,
        "errors": errors,
    }


class AIReviewRequest(BaseModel):
    """Request for AI review of transactions."""
    transactions: List[dict]


@router.post("/budget/statements/ai-review")
def ai_review_parsed_transactions(
    data: AIReviewRequest,
    session: Session = Depends(get_session)
):
    """
    Run AI review on already-parsed transactions.
    Use this to re-categorize transactions with AI assistance.
    """
    openai_key = get_setting_value(session, "openai_api_key")

    if not openai_key or not is_ai_available(openai_key):
        return {
            "success": False,
            "error": "OpenAI API key not configured. Please add it in Settings.",
            "transactions": data.transactions,
        }

    # Get categories
    categories = session.exec(select(BudgetCategory)).all()
    category_list = [{"id": c.id, "name": c.name, "is_income": c.is_income} for c in categories]
    category_id_map = {c.id: c for c in categories}

    try:
        # Run AI review
        enhanced_txns = ai_review_transactions(data.transactions, category_list, openai_key)

        # Format response
        result_transactions = []
        for i, txn in enumerate(enhanced_txns):
            cat_id = txn.get("suggested_category_id")
            cat_name = None
            if cat_id and cat_id in category_id_map:
                cat_name = category_id_map[cat_id].name

            result_transactions.append({
                "index": i,
                "date": txn.get("date", ""),
                "description": txn.get("description", ""),
                "amount": txn.get("amount", 0),
                "merchant": txn.get("merchant"),
                "suggested_category_id": cat_id,
                "suggested_category_name": cat_name,
                "clean_description": txn.get("clean_description"),
                "ai_reviewed": txn.get("ai_reviewed", False),
                "confidence": 0.9 if txn.get("ai_reviewed") else 0.7,
            })

        return {
            "success": True,
            "transactions": result_transactions,
            "ai_enhanced": True,
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"AI review failed: {str(e)}",
            "transactions": data.transactions,
        }


@router.get("/budget/statements/supported-formats")
def get_supported_formats(session: Session = Depends(get_session)):
    """Get list of supported file formats and their requirements."""
    openai_key = get_setting_value(session, "openai_api_key")
    ai_available = bool(openai_key)

    return {
        "formats": [
            {
                "extension": ".csv",
                "name": "CSV",
                "description": "Comma-separated values. Most banks support this.",
                "requires_ai": False,
                "available": True,
            },
            {
                "extension": ".ofx",
                "name": "OFX",
                "description": "Open Financial Exchange format.",
                "requires_ai": False,
                "available": True,
            },
            {
                "extension": ".qfx",
                "name": "QFX",
                "description": "Quicken format (same as OFX).",
                "requires_ai": False,
                "available": True,
            },
            {
                "extension": ".pdf",
                "name": "PDF",
                "description": "Bank statement PDF. Requires AI.",
                "requires_ai": True,
                "available": ai_available,
            },
            {
                "extension": ".png/.jpg",
                "name": "Image",
                "description": "Screenshot of bank statement. Requires AI.",
                "requires_ai": True,
                "available": ai_available,
            },
        ],
        "ai_available": ai_available,
        "ai_message": "Configure OpenAI API key in Settings for PDF/image support" if not ai_available else "AI parsing enabled",
    }
