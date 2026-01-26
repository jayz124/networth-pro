import { fetchHoldings } from "@/lib/api";
import { PortfolioContent } from "@/components/portfolio/portfolio-content";

export default async function PortfolioPage() {
    // In a real app we'd fetch these from the backend
    // Our mock API now returns the enhanced data structure
    const holdings = await fetchHoldings();

    return (
        <PortfolioContent initialHoldings={holdings} />
    );
}
