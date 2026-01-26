import sqlite3
import os
import sys
from sqlmodel import Session, select
from core.database import engine, init_db
from models import Account, Liability, Portfolio

# Path to legacy DB (Absolute path so it works even if we move this project)
LEGACY_DB_PATH = "/Users/jacobzachariah/Desktop/Projects/networth-app/networth.db"

def migrate_data():
    if not os.path.exists(LEGACY_DB_PATH):
        print(f"Error: Legacy database not found at {LEGACY_DB_PATH}")
        return

    print("Initializing V2 Database...")
    init_db()
    
    print(f"Connecting to legacy DB: {LEGACY_DB_PATH}")
    conn = sqlite3.connect(LEGACY_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    with Session(engine) as session:
        # 1. Migrate Accounts
        print("Migrating Accounts...")
        try:
            cursor.execute("SELECT * FROM accounts")
            accounts = cursor.fetchall()
            for row in accounts:
                # Check if exists
                existing = session.exec(select(Account).where(Account.name == row['name'])).first()
                if not existing:
                    acc = Account(
                        name=row['name'],
                        institution=row['institution'],
                        type=row['type'],
                        currency=row['currency'],
                        tags=row['tags'] if 'tags' in row.keys() else None
                    )
                    session.add(acc)
            session.commit()
            print(f"✓ Processed {len(accounts)} accounts")
        except Exception as e:
            print(f"Error migrating accounts: {e}")

        # 2. Migrate Liabilities
        print("Migrating Liabilities...")
        try:
            cursor.execute("SELECT * FROM liabilities")
            liabs = cursor.fetchall()
            for row in liabs:
                existing = session.exec(select(Liability).where(Liability.name == row['name'])).first()
                if not existing:
                    liab = Liability(
                        name=row['name'],
                        category=row['category'] if 'category' in row.keys() else None,
                        currency=row['currency'],
                        tags=row['tags'] if 'tags' in row.keys() else None
                    )
                    session.add(liab)
            session.commit()
            print(f"✓ Processed {len(liabs)} liabilities")
        except Exception as e:
            print(f"Error migrating liabilities: {e}")

        # 3. Migrate Portfolios
        print("Migrating Portfolios...")
        try:
            cursor.execute("SELECT * FROM portfolios")
            portfolios = cursor.fetchall()
            for row in portfolios:
                existing = session.exec(select(Portfolio).where(Portfolio.name == row['name'])).first()
                if not existing:
                    port = Portfolio(
                        name=row['name'],
                        description=row['description'],
                        currency=row['currency'],
                        is_active=bool(row['is_active'])
                    )
                    session.add(port)
            session.commit()
            print(f"✓ Processed {len(portfolios)} portfolios")
        except Exception as e:
            print(f"Error migrating portfolios: {e}")

        # 4. Migrate Portfolio Holdings
        print("Migrating Portfolio Holdings...")
        try:
            cursor.execute("SELECT * FROM portfolio_holdings")
            holdings = cursor.fetchall()
            from models import PortfolioHolding
            
            # Simple caching of portfolio name to ID map
            p_map = {}
            portfolios = session.exec(select(Portfolio)).all()
            for p in portfolios:
                p_map[p.name] = p.id

            count = 0
            for row in holdings:
                # Get legacy portfolio name to map to new ID
                # (Assuming legacy portfolio_id maps to a name we migrated)
                leg_p_id = row['portfolio_id']
                leg_p_name = cursor.execute("SELECT name FROM portfolios WHERE id = ?", (leg_p_id,)).fetchone()
                
                if leg_p_name and leg_p_name['name'] in p_map:
                    new_p_id = p_map[leg_p_name['name']]
                    
                    # Create holding
                    hold = PortfolioHolding(
                        portfolio_id=new_p_id,
                        ticker=row['ticker'],
                        asset_type=row['asset_type'],
                        quantity=row['quantity'],
                        purchase_price=row['purchase_price'],
                        purchase_date=row['purchase_date'],
                        currency=row['currency'],
                        # We don't have current price in this table usually, it was dynamically fetched
                    )
                    session.add(hold)
                    count += 1
            
            session.commit()
            print(f"✓ Processed {count} holdings")
        except Exception as e:
            print(f"Error migrating holdings: {e}")

        # 4. Migrate Latest Balances (Snapshot)
        print("Migrating Latest Balances...")
        try:
            # Get latest asset balances
            cursor.execute("""
                SELECT b.account_id, b.balance, b.as_of_date, a.currency 
                FROM balances b 
                JOIN accounts a ON b.account_id = a.id
                WHERE b.as_of_date = (SELECT MAX(as_of_date) FROM balances WHERE account_id = b.account_id)
            """)
            balances = cursor.fetchall()
            from models import BalanceSnapshot
            
            from datetime import datetime

            count = 0
            for row in balances:
                # Find V2 account ID by name
                legacy_acc = cursor.execute("SELECT name FROM accounts WHERE id = ?", (row['account_id'],)).fetchone()
                if legacy_acc:
                    v2_acc = session.exec(select(Account).where(Account.name == legacy_acc['name'])).first()
                    if v2_acc:
                        # Parse date string "YYYY-MM-DD" -> datetime
                        date_str = row['as_of_date']
                        try:
                            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        except ValueError:
                            # Fallback if format is different or empty
                            date_obj = datetime.now()

                        # Check if snapshot exists
                        exists = session.exec(select(BalanceSnapshot).where(
                            BalanceSnapshot.account_id == v2_acc.id,
                            BalanceSnapshot.date == date_obj
                        )).first()
                        
                        if not exists:
                            snap = BalanceSnapshot(
                                account_id=v2_acc.id,
                                amount=row['balance'],
                                currency=row['currency'],
                                date=date_obj
                            )
                            session.add(snap)
                            count += 1
            
            # Liabilities balances
            cursor.execute("""
                SELECT b.liability_id, b.balance, b.as_of_date, l.currency 
                FROM liability_balances b 
                JOIN liabilities l ON b.liability_id = l.id
                WHERE b.as_of_date = (SELECT MAX(as_of_date) FROM liability_balances WHERE liability_id = b.liability_id)
            """)
            liab_balances = cursor.fetchall()
            
            for row in liab_balances:
                legacy_liab = cursor.execute("SELECT name FROM liabilities WHERE id = ?", (row['liability_id'],)).fetchone()
                if legacy_liab:
                    v2_liab = session.exec(select(Liability).where(Liability.name == legacy_liab['name'])).first()
                    if v2_liab:
                        date_str = row['as_of_date']
                        try:
                            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                        except ValueError:
                            date_obj = datetime.now()

                        exists = session.exec(select(BalanceSnapshot).where(
                            BalanceSnapshot.liability_id == v2_liab.id,
                            BalanceSnapshot.date == date_obj
                        )).first()
                        
                        if not exists:
                            snap = BalanceSnapshot(
                                liability_id=v2_liab.id,
                                amount=row['balance'],
                                currency=row['currency'],
                                date=date_obj
                            )
                            session.add(snap)
                            count += 1

            session.commit()
            print(f"✓ Migrated {count} balance snapshots")

        except Exception as e:
            print(f"Error migrating balances: {e}")

    conn.close()
    print("Migration Complete.")

if __name__ == "__main__":
    migrate_data()
