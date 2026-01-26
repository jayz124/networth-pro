export async function fetchNetWorth() {
    try {
        const isServer = typeof window === 'undefined';
        const baseUrl = isServer ? 'http://127.0.0.1:8000' : '';

        const res = await fetch(`${baseUrl}/api/v1/networth`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error('Failed to fetch net worth data');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

export async function fetchHistory() {
    try {
        const isServer = typeof window === 'undefined';
        const baseUrl = isServer ? 'http://127.0.0.1:8000' : '';

        const res = await fetch(`${baseUrl}/api/v1/networth/history`, {
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error('Failed to fetch history data');
        }

        return res.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function fetchHoldings() {
    try {
        const isServer = typeof window === 'undefined';
        const baseUrl = isServer ? 'http://127.0.0.1:8000' : '';

        // Use no-store to ensure fresh data on reload
        // Mock data for "World Class" Portfolio experience
        // In a real app, this would come from the backend.
        // We simulate a delay to show loading states if needed, but keeping it fast for now.
        
        return [
            // Personal Stock Portfolio
            { id: 1, portfolioId: "personal", ticker: "AAPL", asset_type: "Stock", quantity: 150, currency: "USD", purchase_price: 145.30, current_value: 26250.00, change_24h: 1.25, name: "Apple Inc." },
            { id: 2, portfolioId: "personal", ticker: "MSFT", asset_type: "Stock", quantity: 80, currency: "USD", purchase_price: 280.50, current_value: 32400.00, change_24h: -0.5, name: "Microsoft Corp." },
            { id: 3, portfolioId: "personal", ticker: "VOO", asset_type: "ETF", quantity: 50, currency: "USD", purchase_price: 360.00, current_value: 21500.00, change_24h: 0.8, name: "Vanguard S&P 500 ETF" },
            
            // Crypto Portfolio
            { id: 4, portfolioId: "crypto", ticker: "BTC", asset_type: "Crypto", quantity: 1.5, currency: "USD", purchase_price: 35000.00, current_value: 96000.00, change_24h: 2.5, name: "Bitcoin" },
            { id: 5, portfolioId: "crypto", ticker: "ETH", asset_type: "Crypto", quantity: 12, currency: "USD", purchase_price: 1800.00, current_value: 38400.00, change_24h: 1.1, name: "Ethereum" },
            { id: 6, portfolioId: "crypto", ticker: "SOL", asset_type: "Crypto", quantity: 150, currency: "USD", purchase_price: 45.00, current_value: 22500.00, change_24h: 4.2, name: "Solana" },

            // Real Estate
            { id: 7, portfolioId: "real_estate", ticker: "PROP-001", asset_type: "Real Estate", quantity: 1, currency: "USD", purchase_price: 450000.00, current_value: 520000.00, change_24h: 0.0, name: "Downtown Apartment" },
            { id: 8, portfolioId: "real_estate", ticker: "REIT-O", asset_type: "REIT", quantity: 500, currency: "USD", purchase_price: 55.00, current_value: 29000.00, change_24h: 0.3, name: "Realty Income Corp" },

            // Retirement
             { id: 9, portfolioId: "retirement", ticker: "VTI", asset_type: "ETF", quantity: 400, currency: "USD", purchase_price: 180.00, current_value: 92000.00, change_24h: 0.6, name: "Vanguard Total Stock Market" },
        ];
    } catch (error) {
        console.error(error);
        return [];
    }
}
