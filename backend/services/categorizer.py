"""
Rule-based transaction categorizer.
Uses keyword matching for fast, offline categorization.
"""
from typing import Optional, Tuple
import re


# Category keywords mapping (category_name -> keywords)
CATEGORY_KEYWORDS = {
    "Salary": [
        "payroll", "salary", "wages", "direct deposit", "paycheck",
        "employer", "income", "bonus", "commission"
    ],
    "Housing": [
        "rent", "mortgage", "hoa", "property tax", "home insurance",
        "landlord", "apartment", "lease"
    ],
    "Food & Dining": [
        "restaurant", "cafe", "coffee", "starbucks", "mcdonalds", "burger",
        "pizza", "chipotle", "subway", "wendys", "taco bell", "dunkin",
        "uber eats", "doordash", "grubhub", "seamless", "postmates",
        "grocery", "walmart", "target", "costco", "whole foods", "trader joe",
        "kroger", "safeway", "publix", "aldi", "dining", "food"
    ],
    "Transportation": [
        "uber", "lyft", "taxi", "gas", "shell", "chevron", "exxon", "bp",
        "parking", "toll", "metro", "transit", "bus", "train", "amtrak",
        "car wash", "auto repair", "mechanic", "oil change"
    ],
    "Utilities": [
        "electric", "water", "gas bill", "internet", "comcast", "verizon",
        "at&t", "t-mobile", "sprint", "phone bill", "cable", "utility"
    ],
    "Shopping": [
        "amazon", "ebay", "walmart", "target", "costco", "best buy",
        "apple store", "ikea", "home depot", "lowes", "nordstrom", "macys",
        "tj maxx", "marshalls", "ross", "kohls", "jcpenney", "shopping"
    ],
    "Entertainment": [
        "movie", "cinema", "theatre", "concert", "ticketmaster", "stubhub",
        "gaming", "playstation", "xbox", "nintendo", "steam", "twitch",
        "spotify", "apple music", "pandora", "hulu", "disney+", "hbo",
        "paramount", "peacock", "youtube premium"
    ],
    "Healthcare": [
        "pharmacy", "cvs", "walgreens", "rite aid", "doctor", "hospital",
        "clinic", "dental", "optometrist", "prescription", "medical",
        "health insurance", "copay", "lab", "urgent care"
    ],
    "Subscriptions": [
        "netflix", "spotify", "hulu", "disney", "amazon prime", "youtube",
        "apple", "google one", "dropbox", "adobe", "microsoft 365",
        "gym", "fitness", "membership", "subscription", "monthly"
    ],
}


def categorize_transaction(
    description: str,
    merchant: Optional[str] = None,
    amount: float = 0.0
) -> Tuple[Optional[str], float]:
    """
    Categorize a transaction based on description and merchant.

    Returns:
        Tuple of (category_name, confidence_score)
        category_name is None if no match found
        confidence_score is between 0.0 and 1.0
    """
    # Combine description and merchant for matching
    text = f"{description} {merchant or ''}".lower()

    # Check each category's keywords
    best_match = None
    best_score = 0.0

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in text:
                # Calculate confidence based on keyword length and match quality
                keyword_len = len(keyword)
                if keyword_len >= 8:
                    score = 0.95  # Long specific keywords = high confidence
                elif keyword_len >= 5:
                    score = 0.85
                else:
                    score = 0.70

                # Exact word match bonus
                if re.search(rf'\b{re.escape(keyword)}\b', text, re.IGNORECASE):
                    score = min(score + 0.05, 1.0)

                if score > best_score:
                    best_score = score
                    best_match = category

    # Special rules for income vs expense
    if amount > 0 and best_match not in ["Salary"]:
        # Positive amounts that aren't salary might be refunds or deposits
        if any(word in text for word in ["refund", "return", "cashback", "rebate"]):
            best_match = "Other"
            best_score = 0.75

    return best_match, best_score


def detect_recurring_pattern(
    transactions: list,
    min_occurrences: int = 2,
    amount_tolerance: float = 0.10  # 10% tolerance
) -> list:
    """
    Detect recurring transactions that might be subscriptions.

    Args:
        transactions: List of transaction dicts with 'description', 'amount', 'date'
        min_occurrences: Minimum times a pattern must appear
        amount_tolerance: Percentage tolerance for amount matching

    Returns:
        List of detected subscription patterns
    """
    from collections import defaultdict
    from datetime import timedelta

    # Group by similar merchant/description
    groups = defaultdict(list)

    for txn in transactions:
        # Create a normalized key from description
        desc = txn.get("description", "").lower()
        merchant = txn.get("merchant", "").lower() if txn.get("merchant") else ""

        # Remove numbers and special chars for grouping
        key = re.sub(r'[0-9#*\-_]+', '', f"{merchant} {desc}").strip()
        key = " ".join(key.split())  # Normalize whitespace

        if len(key) >= 3:  # Only group if key is meaningful
            groups[key].append(txn)

    detected_subscriptions = []

    for key, txns in groups.items():
        if len(txns) < min_occurrences:
            continue

        # Check if amounts are similar
        amounts = [abs(t.get("amount", 0)) for t in txns]
        avg_amount = sum(amounts) / len(amounts)

        if avg_amount == 0:
            continue

        # Check variance
        amount_variance = max(amounts) - min(amounts)
        if amount_variance / avg_amount > amount_tolerance:
            continue  # Amounts too different

        # Determine frequency by checking date intervals
        dates = sorted([t["date"] for t in txns if "date" in t])
        if len(dates) < 2:
            continue

        intervals = []
        for i in range(1, len(dates)):
            delta = (dates[i] - dates[i-1]).days
            intervals.append(delta)

        avg_interval = sum(intervals) / len(intervals)

        # Classify frequency
        if 25 <= avg_interval <= 35:
            frequency = "monthly"
        elif 350 <= avg_interval <= 380:
            frequency = "yearly"
        elif 12 <= avg_interval <= 16:
            frequency = "biweekly"
        elif 6 <= avg_interval <= 8:
            frequency = "weekly"
        else:
            frequency = "irregular"

        if frequency != "irregular":
            # Get most recent transaction for naming
            latest_txn = max(txns, key=lambda t: t.get("date", 0))

            detected_subscriptions.append({
                "name": latest_txn.get("merchant") or latest_txn.get("description", key)[:50],
                "amount": round(avg_amount, 2),
                "frequency": frequency,
                "occurrences": len(txns),
                "last_date": dates[-1] if dates else None,
                "sample_description": latest_txn.get("description", ""),
            })

    # Sort by amount descending
    detected_subscriptions.sort(key=lambda x: x["amount"], reverse=True)

    return detected_subscriptions
