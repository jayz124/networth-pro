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


# Security metadata cache
class SecurityInfo(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True, unique=True)
    name: str
    asset_type: str  # stock, etf, crypto, bond, mutual_fund
    exchange: Optional[str] = None
    currency: str = Field(default="USD")
    sector: Optional[str] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# Price cache (5-min TTL)
class PriceCache(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    current_price: float
    previous_close: Optional[float] = None
    change_percent: Optional[float] = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


# Real Estate
class Property(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    address: str
    property_type: str  # residential, commercial, rental, land
    purchase_price: float
    purchase_date: Optional[str] = None
    current_value: float
    currency: str = Field(default="USD")


class Mortgage(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id")
    lender: Optional[str] = None
    original_principal: float
    current_balance: float
    interest_rate: float
    monthly_payment: float
    term_years: int
    is_active: bool = Field(default=True)


# Retirement Planning
class RetirementPlan(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None
    mode: str  # "pro" or "essential"
    config_json: str  # JSON-serialized config
    is_active: bool = Field(default=False)


# Budgeting
class BudgetCategory(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    icon: Optional[str] = None
    color: Optional[str] = None
    budget_limit: Optional[float] = None
    is_income: bool = Field(default=False)


class Transaction(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime = Field(index=True)
    description: str
    amount: float  # Positive=income, negative=expense
    category_id: Optional[int] = Field(default=None, foreign_key="budgetcategory.id")
    account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    is_recurring: bool = Field(default=False)
    recurrence_frequency: Optional[str] = None  # daily, weekly, bi-weekly, monthly, yearly
    merchant: Optional[str] = None
    notes: Optional[str] = None
    ai_categorized: bool = Field(default=False)


class Subscription(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    amount: float
    frequency: str  # monthly, yearly
    category_id: Optional[int] = Field(default=None, foreign_key="budgetcategory.id")
    next_billing_date: Optional[datetime] = None
    is_active: bool = Field(default=True)


# Application Settings
class AppSettings(BaseModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, unique=True)
    value: Optional[str] = None
    is_secret: bool = Field(default=False)  # If true, value should be masked in API responses
