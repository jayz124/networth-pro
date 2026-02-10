import logging
import os
import sqlite3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def _ensure_property_columns():
    """Add new columns to existing Property table (SQLite ALTER TABLE)."""
    from core.database import sqlite_file_name
    db_path = sqlite_file_name
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    for col, col_type in [
        ("provider_property_id", "TEXT"),
        ("valuation_provider", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE property ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass  # Column already exists
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    init_db()
    _ensure_property_columns()
    yield
    # Shutdown

from api import dashboard, portfolio, securities, real_estate, accounts, liabilities, retirement, budget, budget_ai, dashboard_ai, settings, statements

app = FastAPI(title="Networth Pro API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(securities.router, prefix="/api/v1")
app.include_router(real_estate.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(liabilities.router, prefix="/api/v1")
app.include_router(retirement.router, prefix="/api/v1")
app.include_router(budget.router, prefix="/api/v1")
app.include_router(budget_ai.router, prefix="/api/v1")
app.include_router(dashboard_ai.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(statements.router, prefix="/api/v1")
from api import plaid
app.include_router(plaid.router)  # /api/plaid prefix is defined in the router itself

@app.get("/")
def read_root():
    return {"message": "Networth Pro API is running", "version": "2.0.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
