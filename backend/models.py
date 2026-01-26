from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime

class BaseModel(SQLModel):
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Account(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    institution: Optional[str] = None
    type: str  # Check/Savings/Investment
    currency: str = Field(default="USD")
    tags: Optional[str] = None
    
    # We will add relationships later

class Liability(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    category: Optional[str] = None
    currency: str = Field(default="USD")
    tags: Optional[str] = None

class Portfolio(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None
    currency: str = Field(default="USD")
    is_active: bool = Field(default=True)

class PortfolioHolding(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    portfolio_id: int = Field(foreign_key="portfolio.id")
    ticker: str
    asset_type: str
    quantity: float
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    currency: str = Field(default="USD")
    current_price: Optional[float] = None # Cached price
    current_value: Optional[float] = None # Calculated (qty * price)

# Snapshot table for historical tracking (Normalized!)
class BalanceSnapshot(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime = Field(index=True)
    
    # identifying the entity
    account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    liability_id: Optional[int] = Field(default=None, foreign_key="liability.id")
    
    # value
    amount: float
    currency: str
