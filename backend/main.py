from fastapi import FastAPI
from contextlib import asynccontextmanager
from core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    init_db()
    yield
    # Shutdown

from api import dashboard, portfolio, securities, real_estate

app = FastAPI(title="Networth Pro API", lifespan=lifespan)

app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(portfolio.router, prefix="/api/v1")
app.include_router(securities.router, prefix="/api/v1")
app.include_router(real_estate.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Networth Pro API is running", "version": "2.0.0"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
