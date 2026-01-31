"""
Settings API - Application settings including API keys.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_session
from models import AppSettings

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
    "openai_api_key": {"is_secret": True, "description": "OpenAI API Key for AI features"},
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
