"""
Retirement Plans API - CRUD for saving and managing retirement configurations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from core.database import get_session
from models import RetirementPlan

router = APIRouter(tags=["Retirement Plans"])


# Pydantic schemas
class RetirementPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    mode: str  # "pro" or "essential"
    config_json: str  # JSON-serialized config


class RetirementPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    config_json: Optional[str] = None


class RetirementPlanResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    mode: str
    config_json: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# CRUD endpoints
@router.get("/retirement/plans")
def list_plans(session: Session = Depends(get_session)):
    """List all saved retirement plans."""
    plans = session.exec(
        select(RetirementPlan).order_by(RetirementPlan.updated_at.desc())
    ).all()
    return [
        {
            "id": plan.id,
            "name": plan.name,
            "description": plan.description,
            "mode": plan.mode,
            "is_active": plan.is_active,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
        }
        for plan in plans
    ]


@router.post("/retirement/plans")
def create_plan(data: RetirementPlanCreate, session: Session = Depends(get_session)):
    """Create a new retirement plan."""
    # Check for duplicate name
    existing = session.exec(
        select(RetirementPlan).where(RetirementPlan.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plan with this name already exists")

    plan = RetirementPlan(
        name=data.name,
        description=data.description,
        mode=data.mode,
        config_json=data.config_json,
        is_active=False,
    )
    session.add(plan)
    session.commit()
    session.refresh(plan)

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "mode": plan.mode,
        "config_json": plan.config_json,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.get("/retirement/plans/active")
def get_active_plan(session: Session = Depends(get_session)):
    """Get the currently active retirement plan."""
    plan = session.exec(
        select(RetirementPlan).where(RetirementPlan.is_active == True)
    ).first()

    if not plan:
        return None

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "mode": plan.mode,
        "config_json": plan.config_json,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.get("/retirement/plans/{plan_id}")
def get_plan(plan_id: int, session: Session = Depends(get_session)):
    """Get a specific retirement plan with its configuration."""
    plan = session.get(RetirementPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "mode": plan.mode,
        "config_json": plan.config_json,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.put("/retirement/plans/{plan_id}")
def update_plan(
    plan_id: int,
    data: RetirementPlanUpdate,
    session: Session = Depends(get_session)
):
    """Update an existing retirement plan."""
    plan = session.get(RetirementPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if data.name is not None:
        # Check for duplicate name
        existing = session.exec(
            select(RetirementPlan).where(
                RetirementPlan.name == data.name,
                RetirementPlan.id != plan_id
            )
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Plan with this name already exists")
        plan.name = data.name
    if data.description is not None:
        plan.description = data.description
    if data.mode is not None:
        plan.mode = data.mode
    if data.config_json is not None:
        plan.config_json = data.config_json

    plan.updated_at = datetime.now(timezone.utc)
    session.add(plan)
    session.commit()
    session.refresh(plan)

    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "mode": plan.mode,
        "config_json": plan.config_json,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


@router.delete("/retirement/plans/{plan_id}")
def delete_plan(plan_id: int, session: Session = Depends(get_session)):
    """Delete a retirement plan."""
    plan = session.get(RetirementPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    session.delete(plan)
    session.commit()
    return {"message": "Plan deleted", "id": plan_id}


@router.post("/retirement/plans/{plan_id}/activate")
def activate_plan(plan_id: int, session: Session = Depends(get_session)):
    """Set a plan as the active plan (deactivates others)."""
    plan = session.get(RetirementPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Deactivate all other plans
    all_plans = session.exec(select(RetirementPlan)).all()
    for p in all_plans:
        p.is_active = (p.id == plan_id)
        session.add(p)

    session.commit()
    session.refresh(plan)

    return {
        "id": plan.id,
        "name": plan.name,
        "is_active": plan.is_active,
        "message": "Plan activated",
    }
