from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from typing import List, Dict, Optional
from core.database import get_session
from models import Account, Liability, BalanceSnapshot
from datetime import datetime

router = APIRouter()

@router.get("/networth")
def get_networth(session: Session = Depends(get_session)):
    """
    Get the latest Net Worth snapshot.
    Calculates: Total Assets - Total Liabilities using the most recent balance for each account.
    """
    # 1. Get latest snapshot for each Asset
    # Using a subquery approach or just iterating based on known logic
    
    # Simple logic: Fetch all active accounts
    accounts = session.exec(select(Account)).all()
    total_assets = 0.0
    
    asset_breakdown = []
    
    for account in accounts:
        # Get latest snapshot
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.account_id == account.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        
        balance = snap.amount if snap else 0.0
        total_assets += balance
        asset_breakdown.append({
            "name": account.name,
            "balance": balance,
            "currency": account.currency
        })

    # 2. Liabilities
    liabilities = session.exec(select(Liability)).all()
    total_liabilities = 0.0
    liab_breakdown = []
    
    for liab in liabilities:
        snap = session.exec(
            select(BalanceSnapshot)
            .where(BalanceSnapshot.liability_id == liab.id)
            .order_by(BalanceSnapshot.date.desc())
        ).first()
        
        balance = snap.amount if snap else 0.0
        total_liabilities += balance
        liab_breakdown.append({
            "name": liab.name,
            "balance": balance,
            "currency": liab.currency
        })

    net_worth = total_assets - total_liabilities

    return {
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "currency": "USD", # Defaulting to USD for MVP
        "assets": asset_breakdown,
        "liabilities": liab_breakdown
    }

@router.get("/networth/history")
def get_networth_history(session: Session = Depends(get_session)):
    """
    Get historical Net Worth over time.
    Aggregates BalanceSnapshots by date.
    """
    # 1. Get all snapshots ordered by date
    snapshots = session.exec(
        select(BalanceSnapshot).order_by(BalanceSnapshot.date)
    ).all()
    
    history_map = {}
    
    for snap in snapshots:
        date_str = snap.date.strftime("%Y-%m-%d")
        if date_str not in history_map:
            history_map[date_str] = {"date": date_str, "assets": 0.0, "liabilities": 0.0}
            
        if snap.account_id:
            history_map[date_str]["assets"] += snap.amount
        elif snap.liability_id:
            # Liability values in DB are positive debts, so we subtract them from net worth later
            history_map[date_str]["liabilities"] += snap.amount
            
    # Convert to list and sort
    history_list = []
    for date_key in sorted(history_map.keys()):
        item = history_map[date_key]
        item["net_worth"] = item["assets"] - item["liabilities"]
        history_list.append(item)
        
    return history_list
