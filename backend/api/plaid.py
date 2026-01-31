
import os
from datetime import datetime, timedelta
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/plaid", tags=["plaid"])

# --- Configuration ---
PLAID_CLIENT_ID = os.getenv("PLAID_CLIENT_ID")
PLAID_SECRET = os.getenv("PLAID_SECRET")
PLAID_ENV = os.getenv("PLAID_ENV", "sandbox")

if not PLAID_CLIENT_ID or not PLAID_SECRET:
    print("WARNING: Plaid credentials not found in environment variables.")

host = plaid.Environment.Sandbox
if PLAID_ENV == "development":
    host = plaid.Environment.Development
elif PLAID_ENV == "production":
    host = plaid.Environment.Production

configuration = plaid.Configuration(
    host=host,
    api_key={
        'clientId': PLAID_CLIENT_ID or "",
        'secret': PLAID_SECRET or "",
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

# --- Models ---
class PublicTokenExchangeRequest(BaseModel):
    public_token: str

class AccountBalance(BaseModel):
    account_id: str
    name: str
    mask: Optional[str]
    type: str
    subtype: Optional[str]
    current_balance: Optional[float]
    available_balance: Optional[float]
    currency: Optional[str]

# --- Endpoints ---

@router.post("/create_link_token")
async def create_link_token():
    try:
        request = LinkTokenCreateRequest(
            products=[Products('transactions')],
            client_name="Networth Pro",
            country_codes=[CountryCode('US')],
            language='en',
            user=LinkTokenCreateRequestUser(
                client_user_id=str(datetime.now().timestamp()) # Unique user ID logic here
            )
        )
        response = client.link_token_create(request)
        return {"link_token": response['link_token']}
    except plaid.ApiException as e:
        print(f"Plaid Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exchange_public_token")
async def exchange_public_token(payload: PublicTokenExchangeRequest = Body(...)):
    try:
        request = ItemPublicTokenExchangeRequest(
            public_token=payload.public_token
        )
        response = client.item_public_token_exchange(request)
        access_token = response['access_token']
        item_id = response['item_id']
        
        # TODO: Save access_token and item_id to database associated with the user
        # For now, we will return them (NOT SECURE FOR PRODUCTION - PROTOTYPE ONLY)
        return {"access_token": access_token, "item_id": item_id}
        
    except plaid.ApiException as e:
        print(f"Plaid Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/balance/{access_token}")
async def get_balance(access_token: str):
    """
    Fetches real-time balance for the given access token.
    In a real app, you'd look up the access token from the DB using a session/user ID.
    """
    try:
        request = AccountsBalanceGetRequest(
            access_token=access_token
        )
        response = client.accounts_balance_get(request)
        
        accounts = []
        for acc in response['accounts']:
            accounts.append({
                "account_id": acc['account_id'],
                "name": acc['name'],
                "mask": acc['mask'],
                "type": str(acc['type']),
                "subtype": str(acc['subtype']),
                "current_balance": acc['balances']['current'],
                "available_balance": acc['balances']['available'],
                "currency": acc['balances']['iso_currency_code'],
            })
            
        return {"accounts": accounts}
        
    except plaid.ApiException as e:
        print(f"Plaid Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
