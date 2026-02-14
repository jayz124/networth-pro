import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getHoldings, getPortfolios } from "@/lib/services/portfolio";
import { PortfolioContent } from "@/components/portfolio/portfolio-content";

export default async function PortfolioPage() {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    // Direct service calls — no HTTP round-trip needed in server components
    const [holdings, portfolios] = await Promise.all([
        getHoldings(userId).catch(() => []),
        getPortfolios(userId).catch(() => [])
    ]);

    return (
        <PortfolioContent
            initialHoldings={holdings}
            initialPortfolios={portfolios}
        />
    );
}
