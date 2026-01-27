import { fetchHoldings, fetchPortfolios } from "@/lib/api";
import { PortfolioContent } from "@/components/portfolio/portfolio-content";

export default async function PortfolioPage() {
    // Fetch holdings and portfolios from the backend
    const [holdings, portfolios] = await Promise.all([
        fetchHoldings(),
        fetchPortfolios()
    ]);

    return (
        <PortfolioContent
            initialHoldings={holdings}
            initialPortfolios={portfolios}
        />
    );
}
