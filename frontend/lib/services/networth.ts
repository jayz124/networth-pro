import { prisma } from '@/lib/prisma';
import { NetWorth } from '@/lib/api';
import { convert } from '@/lib/services/fx-service';

async function convertCurrency(amount: number, fromCcy: string, toCcy: string): Promise<number> {
    return convert(amount, fromCcy, toCcy);
}

export async function getNetWorth(): Promise<NetWorth> {
    // 1. Get Base Currency
    const settings = await prisma.appSettings.findUnique({
        where: { key: 'default_currency' },
    });
    const baseCcy = settings?.value || 'USD';

    // 2. Cash Accounts (Assets)
    const accounts = await prisma.account.findMany({
        include: {
            balance_snapshots: {
                orderBy: { date: 'desc' },
                take: 1,
            },
        },
    });

    let totalCash = 0;
    const assetBreakdown: NetWorth['assets'] = [];

    for (const account of accounts) {
        // specific logic: if snapshot exists use it, else use helper field or 0
        const snapshot = account.balance_snapshots[0];
        const rawBalance = snapshot ? snapshot.amount : (account.current_balance || 0);
        const balance = await convertCurrency(rawBalance, account.currency, baseCcy);

        totalCash += balance;
        assetBreakdown.push({
            name: account.name,
            balance: balance,
            currency: baseCcy,
            type: 'cash',
        });
    }

    // 3. Investments
    const portfolios = await prisma.portfolio.findMany({
        include: {
            holdings: true,
        },
    });

    let totalInvestments = 0;

    for (const portfolio of portfolios) {
        let portfolioValue = 0;
        for (const holding of portfolio.holdings) {
            const holdingValue = holding.current_value || 0;
            const converted = await convertCurrency(holdingValue, holding.currency, baseCcy);
            portfolioValue += converted;
        }
        totalInvestments += portfolioValue;

        assetBreakdown.push({
            name: portfolio.name,
            balance: portfolioValue,
            currency: baseCcy,
            type: 'investment',
        });
    }

    // 4. Real Estate
    const properties = await prisma.property.findMany();
    let totalRealEstate = 0;

    for (const prop of properties) {
        const value = await convertCurrency(prop.current_value, prop.currency, baseCcy);
        totalRealEstate += value;

        assetBreakdown.push({
            name: prop.name,
            balance: value,
            currency: baseCcy,
            type: 'real_estate',
        });
    }

    // 5. Liabilities & Mortgages
    const liabilities = await prisma.liability.findMany({
        include: {
            balance_snapshots: {
                orderBy: { date: 'desc' },
                take: 1,
            },
        },
    });
    const mortgages = await prisma.mortgage.findMany({
        where: { is_active: true },
        include: {
            property: true,
        },
    });

    let totalLiabilities = 0;
    const liabilityBreakdown: NetWorth['liabilities'] = [];

    // Mortgages
    for (const m of mortgages) {
        const mCcy = m.property?.currency || 'USD';
        const balance = await convertCurrency(m.current_balance, mCcy, baseCcy);
        totalLiabilities += balance;

        liabilityBreakdown.push({
            name: `Mortgage - ${m.property?.name || 'Unknown'}`,
            balance: balance,
            currency: baseCcy,
        });
    }

    // Other Liabilities
    for (const liab of liabilities) {
        const snapshot = liab.balance_snapshots[0];
        const rawBalance = snapshot ? snapshot.amount : (liab.current_balance || 0);
        const balance = await convertCurrency(rawBalance, liab.currency, baseCcy);
        totalLiabilities += balance;

        liabilityBreakdown.push({
            name: liab.name,
            balance: balance,
            currency: baseCcy,
        });
    }

    const totalAssets = totalCash + totalInvestments + totalRealEstate;
    const netWorth = totalAssets - totalLiabilities;

    // Persist snapshot (upsert logic)
    const today = new Date().toISOString().split('T')[0];
    try {
        // Check if snapshot exists
        const existing = await prisma.netWorthSnapshot.findUnique({
            where: { date: today },
        });

        // Calculate total mortgages for snapshot breakdown
        let totalMortgages = 0;
        for (const m of mortgages) {
            totalMortgages += await convertCurrency(m.current_balance, m.property?.currency || 'USD', baseCcy);
        }

        const data = {
            date: today,
            total_cash: totalCash,
            total_investments: totalInvestments,
            total_real_estate: totalRealEstate,
            total_liabilities: totalLiabilities - totalMortgages, // Separate them
            total_mortgages: totalMortgages,
            net_worth: netWorth,
        };

        if (existing) {
            await prisma.netWorthSnapshot.update({
                where: { date: today },
                data,
            });
        } else {
            await prisma.netWorthSnapshot.create({
                data,
            });
        }
    } catch (error) {
        console.error("Failed to persist snapshot:", error);
    }

    return {
        net_worth: netWorth,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        currency: baseCcy,
        breakdown: {
            cash_accounts: totalCash,
            investments: totalInvestments,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            real_estate_equity: totalRealEstate - (liabilityBreakdown.filter(l => l.name.startsWith('Mortgage')).reduce((acc: number, l: any) => acc + l.balance, 0)),
        },
        assets: assetBreakdown,
        liabilities: liabilityBreakdown,
    };
}

export async function getNetWorthHistory() {
    const snapshots = await prisma.netWorthSnapshot.findMany({
        orderBy: { date: 'asc' },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const history = snapshots.map((snap: any) => ({
        date: snap.date,
        assets: snap.total_cash + snap.total_investments + snap.total_real_estate,
        liabilities: snap.total_liabilities + snap.total_mortgages,
        net_worth: snap.net_worth,
    }));

    return history;
}

export async function getNetWorthBreakdown() {
    // 1. Base Currency
    const settings = await prisma.appSettings.findUnique({ where: { key: 'default_currency' } });
    const baseCcy = settings?.value || 'USD';

    // 2. Cash
    const accounts = await prisma.account.findMany({
        include: {
            balance_snapshots: { orderBy: { date: 'desc' }, take: 1 },
        },
    });

    let totalCash = 0;
    const cashItems = [];

    for (const account of accounts) {
        const balance = await convertCurrency(account.balance_snapshots[0]?.amount ?? account.current_balance ?? 0, account.currency, baseCcy);
        totalCash += balance;
        cashItems.push({
            id: account.id,
            name: account.name,
            balance: balance,
            institution: account.institution,
            type: account.type,
        });
    }

    // 3. Investments
    const portfolios = await prisma.portfolio.findMany({ include: { holdings: true } });
    let totalInvestments = 0;
    const investmentItems = [];

    for (const p of portfolios) {
        let pValue = 0;
        for (const h of p.holdings) {
            pValue += await convertCurrency(h.current_value ?? 0, h.currency, baseCcy);
        }
        totalInvestments += pValue;
        investmentItems.push({
            id: p.id,
            name: p.name,
            value: pValue,
            holdings_count: p.holdings.length,
        });
    }

    // 4. Real Estate
    const properties = await prisma.property.findMany({ include: { mortgages: true } });
    let totalRealEstate = 0;
    let totalMortgages = 0;
    const realEstateItems = [];

    for (const p of properties) {
        const value = await convertCurrency(p.current_value, p.currency, baseCcy);
        totalRealEstate += value;

        let mortgageBalance = 0;
        for (const m of p.mortgages) {
            if (m.is_active) {
                mortgageBalance += await convertCurrency(m.current_balance, p.currency, baseCcy);
            }
        }
        totalMortgages += mortgageBalance;

        realEstateItems.push({
            id: p.id,
            name: p.name,
            property_type: p.property_type,
            current_value: value,
            mortgage_balance: mortgageBalance,
            equity: value - mortgageBalance,
        });
    }

    // 5. Liabilities
    const liabilities = await prisma.liability.findMany({
        include: { balance_snapshots: { orderBy: { date: 'desc' }, take: 1 } },
    });

    let totalLiabilities = totalMortgages;
    const liabilityItems = [];

    // Add mortgages
    for (const p of properties) {
        for (const m of p.mortgages) {
            if (m.is_active) {
                liabilityItems.push({
                    id: `mortgage_${m.id}`,
                    name: `Mortgage - ${p.name}`,
                    balance: await convertCurrency(m.current_balance, p.currency, baseCcy),
                    category: 'mortgage',
                });
            }
        }
    }

    // Add other liabilities
    for (const l of liabilities) {
        const balance = await convertCurrency(l.balance_snapshots[0]?.amount ?? l.current_balance ?? 0, l.currency, baseCcy);
        totalLiabilities += balance;
        liabilityItems.push({
            id: l.id,
            name: l.name,
            balance: balance,
            category: l.category,
        });
    }

    return {
        net_worth: (totalCash + totalInvestments + totalRealEstate) - totalLiabilities,
        total_assets: totalCash + totalInvestments + totalRealEstate,
        total_liabilities: totalLiabilities,
        currency: baseCcy,
        categories: {
            cash: { total: totalCash, items: cashItems },
            investments: { total: totalInvestments, items: investmentItems },
            real_estate: { total: totalRealEstate, items: realEstateItems },
            liabilities: { total: totalLiabilities, items: liabilityItems },
        },
    };
}
