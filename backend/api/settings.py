"""
Settings API - Application settings including API keys.
"""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlmodel import Session, SQLModel, select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_session, engine, init_db
from models import (
    AppSettings, Account, Liability, BalanceSnapshot, Portfolio, PortfolioHolding,
    SecurityInfo, PriceCache, Property, PropertyValuationCache, PropertyValueHistory,
    Mortgage, RetirementPlan, BudgetCategory, Transaction, Subscription,
    NetWorthSnapshot, PlaidItem,
)
from services.ai_provider import AIProvider, PROVIDER_CONFIG, resolve_provider

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Settings"])


# Pydantic schemas
class SettingUpdate(BaseModel):
    value: Optional[str] = None


class SettingResponse(BaseModel):
    key: str
    value: Optional[str]
    is_secret: bool
    updated_at: datetime


# Known settings keys
KNOWN_SETTINGS = {
    "groq_api_key": {"is_secret": True, "description": "Groq API Key (free tier, no credit card required)"},
    "openai_api_key": {"is_secret": True, "description": "OpenAI API Key for AI features"},
    "claude_api_key": {"is_secret": True, "description": "Anthropic Claude API Key"},
    "kimi_api_key": {"is_secret": True, "description": "Moonshot AI (Kimi) API Key"},
    "gemini_api_key": {"is_secret": True, "description": "Google Gemini API Key (free tier available)"},
    "ai_provider": {"is_secret": False, "description": "Active AI provider: groq, openai, claude, kimi, or gemini"},
    "ai_model": {"is_secret": False, "description": "AI model override (leave empty for provider default)"},
    "rentcast_api_key": {"is_secret": True, "description": "RentCast API key for property valuations (free: 50 calls/month)"},
    "default_currency": {"is_secret": False, "description": "Default currency for new items"},
}


def mask_secret(value: Optional[str]) -> Optional[str]:
    """Mask a secret value for display."""
    if not value or len(value) < 8:
        return "••••••••" if value else None
    return value[:4] + "••••••••" + value[-4:]


@router.get("/settings")
def list_settings(session: Session = Depends(get_session)):
    """List all application settings."""
    settings = session.exec(select(AppSettings)).all()

    # Create a map of existing settings
    existing = {s.key: s for s in settings}

    result = []
    for key, meta in KNOWN_SETTINGS.items():
        setting = existing.get(key)
        if setting:
            result.append({
                "key": key,
                "value": mask_secret(setting.value) if meta["is_secret"] else setting.value,
                "is_secret": meta["is_secret"],
                "is_set": bool(setting.value),
                "description": meta["description"],
                "updated_at": setting.updated_at,
            })
        else:
            result.append({
                "key": key,
                "value": None,
                "is_secret": meta["is_secret"],
                "is_set": False,
                "description": meta["description"],
                "updated_at": None,
            })

    return result


@router.get("/settings/ai-providers")
def get_ai_providers(session: Session = Depends(get_session)):
    """Get all AI provider metadata, active provider, and configuration status."""
    chosen_provider_str = get_setting_value(session, "ai_provider")
    active_model = get_setting_value(session, "ai_model") or None

    # Resolve with fallback (so the UI reflects what's actually being used)
    active_provider, _ = resolve_provider(
        chosen_provider_str,
        get_key_fn=lambda key: get_setting_value(session, key),
    )

    providers = []
    for provider, config in PROVIDER_CONFIG.items():
        api_key = get_setting_value(session, config["api_key_setting"])
        providers.append({
            "id": provider.value,
            "name": config["display_name"],
            "is_active": provider == active_provider,
            "is_configured": bool(api_key),
            "key_url": config["key_url"],
            "default_model": config["default_model"],
            "supports_vision": config["supports_vision"],
            "supports_json_mode": config["supports_json_mode"],
        })

    return {
        "providers": providers,
        "active_provider": active_provider.value,
        "active_model": active_model or PROVIDER_CONFIG[active_provider]["default_model"],
    }


# --- Data management endpoints ---
# These must be registered BEFORE the /{key} wildcard routes.

# All exportable tables and their models (order matters for import: parents before children)
_EXPORT_TABLES = [
    ("accounts", Account),
    ("liabilities", Liability),
    ("portfolios", Portfolio),
    ("portfolio_holdings", PortfolioHolding),
    ("balance_snapshots", BalanceSnapshot),
    ("securities", SecurityInfo),
    ("price_cache", PriceCache),
    ("properties", Property),
    ("property_valuation_cache", PropertyValuationCache),
    ("property_value_history", PropertyValueHistory),
    ("mortgages", Mortgage),
    ("retirement_plans", RetirementPlan),
    ("budget_categories", BudgetCategory),
    ("transactions", Transaction),
    ("subscriptions", Subscription),
    ("net_worth_snapshots", NetWorthSnapshot),
    ("app_settings", AppSettings),
]


def _row_to_dict(row) -> dict:
    """Convert a SQLModel row to a JSON-serializable dict."""
    d = {}
    for col in row.__class__.__table__.columns:
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[col.name] = val
    return d


@router.post("/settings/reset-database")
def reset_database(
    session: Session = Depends(get_session),
    confirm: bool = True,
):
    """Drop all data and recreate tables. Requires confirm=true."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Confirmation required. Pass confirm=true.")

    session.close()
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    logger.info("Database reset: all tables dropped and recreated")
    return {"message": "Database reset successfully. All data has been deleted."}


@router.get("/settings/export")
def export_data(session: Session = Depends(get_session)):
    """Export all data as JSON."""
    data = {"version": "1.0", "exported_at": datetime.utcnow().isoformat()}

    for key, model in _EXPORT_TABLES:
        try:
            rows = session.exec(select(model)).all()
            data[key] = [_row_to_dict(row) for row in rows]
        except Exception as e:
            logger.warning("Skipping table %s during export: %s", key, e)
            data[key] = []
            session.rollback()

    return JSONResponse(content=data)


@router.post("/settings/import")
async def import_data(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Import data from a JSON backup. Replaces all existing data."""
    try:
        contents = await file.read()
        data = json.loads(contents)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if not isinstance(data, dict) or "version" not in data:
        raise HTTPException(status_code=400, detail="Invalid backup format: missing version field")

    # Clear existing data (reverse order to respect foreign keys)
    for key, model in reversed(_EXPORT_TABLES):
        rows = session.exec(select(model)).all()
        for row in rows:
            session.delete(row)
    session.commit()

    # Import each table
    imported_counts = {}
    for key, model in _EXPORT_TABLES:
        rows_data = data.get(key, [])
        if not isinstance(rows_data, list):
            continue
        count = 0
        for row_data in rows_data:
            try:
                row = model(**row_data)
                session.add(row)
                count += 1
            except Exception as e:
                logger.warning("Skipping invalid row in %s: %s", key, e)
        imported_counts[key] = count

    session.commit()
    logger.info("Data imported: %s", imported_counts)
    return {"message": "Data imported successfully", "counts": imported_counts}


@router.get("/settings/{key}")
def get_setting(key: str, session: Session = Depends(get_session)):
    """Get a specific setting."""
    if key not in KNOWN_SETTINGS:
        raise HTTPException(status_code=404, detail="Unknown setting key")

    setting = session.exec(
        select(AppSettings).where(AppSettings.key == key)
    ).first()

    meta = KNOWN_SETTINGS[key]

    if setting:
        return {
            "key": key,
            "value": mask_secret(setting.value) if meta["is_secret"] else setting.value,
            "is_secret": meta["is_secret"],
            "is_set": bool(setting.value),
            "description": meta["description"],
            "updated_at": setting.updated_at,
        }
    else:
        return {
            "key": key,
            "value": None,
            "is_secret": meta["is_secret"],
            "is_set": False,
            "description": meta["description"],
            "updated_at": None,
        }


@router.put("/settings/{key}")
def update_setting(
    key: str,
    data: SettingUpdate,
    session: Session = Depends(get_session)
):
    """Update a setting value."""
    if key not in KNOWN_SETTINGS:
        raise HTTPException(status_code=404, detail="Unknown setting key")

    meta = KNOWN_SETTINGS[key]

    # Find or create the setting
    setting = session.exec(
        select(AppSettings).where(AppSettings.key == key)
    ).first()

    if setting:
        setting.value = data.value
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSettings(
            key=key,
            value=data.value,
            is_secret=meta["is_secret"],
        )

    session.add(setting)
    session.commit()
    session.refresh(setting)

    return {
        "key": key,
        "value": mask_secret(setting.value) if meta["is_secret"] else setting.value,
        "is_secret": meta["is_secret"],
        "is_set": bool(setting.value),
        "description": meta["description"],
        "updated_at": setting.updated_at,
        "message": "Setting updated successfully",
    }


@router.delete("/settings/{key}")
def delete_setting(key: str, session: Session = Depends(get_session)):
    """Clear a setting value."""
    if key not in KNOWN_SETTINGS:
        raise HTTPException(status_code=404, detail="Unknown setting key")

    setting = session.exec(
        select(AppSettings).where(AppSettings.key == key)
    ).first()

    if setting:
        setting.value = None
        setting.updated_at = datetime.utcnow()
        session.add(setting)
        session.commit()

    return {"message": "Setting cleared", "key": key}


# Internal helper to get settings (for use by other modules)
def get_setting_value(session: Session, key: str) -> Optional[str]:
    """Get the actual value of a setting (not masked)."""
    setting = session.exec(
        select(AppSettings).where(AppSettings.key == key)
    ).first()
    return setting.value if setting else None
