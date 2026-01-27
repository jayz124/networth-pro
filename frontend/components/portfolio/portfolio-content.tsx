"use client"

import * as React from "react"
import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortfolioSelector } from "@/components/portfolio/portfolio-selector"
import { PortfolioSummary } from "@/components/portfolio/portfolio-summary"
import { DataTable } from "@/components/portfolio/data-table"
import { createColumns, Holding } from "@/components/portfolio/columns"
import { AddHoldingDialog } from "@/components/portfolio/add-holding-dialog"
import { Portfolio, fetchPortfolios, fetchHoldings, refreshAllPrices } from "@/lib/api"

type PortfolioContentProps = {
    initialHoldings: Holding[]
    initialPortfolios?: Portfolio[]
}

export function PortfolioContent({ initialHoldings, initialPortfolios = [] }: PortfolioContentProps) {
    const [selectedPortfolio, setSelectedPortfolio] = React.useState("all")
    const [holdings, setHoldings] = React.useState<Holding[]>(initialHoldings)
    const [portfolios, setPortfolios] = React.useState<Portfolio[]>(initialPortfolios)
    const [isRefreshing, setIsRefreshing] = React.useState(false)

    // Load portfolios on mount if not provided
    React.useEffect(() => {
        if (initialPortfolios.length === 0) {
            loadPortfolios()
        }
    }, [initialPortfolios.length])

    const loadPortfolios = async () => {
        const data = await fetchPortfolios()
        setPortfolios(data)
    }

    const loadHoldings = async () => {
        const data = await fetchHoldings()
        setHoldings(data)
    }

    const handleRefresh = async () => {
        setIsRefreshing(true)
        await refreshAllPrices()
        await loadHoldings()
        setIsRefreshing(false)
    }

    const handleHoldingUpdate = () => {
        loadHoldings()
    }

    const handlePortfolioCreated = () => {
        loadPortfolios()
    }

    const handleHoldingAdded = () => {
        loadHoldings()
    }

    // Filter holdings based on selection
    const filteredHoldings = React.useMemo(() => {
        if (selectedPortfolio === "all") return holdings
        return holdings.filter(h => h.portfolio_id.toString() === selectedPortfolio)
    }, [selectedPortfolio, holdings])

    // Calculate metrics
    const metrics = React.useMemo(() => {
        const totalValue = filteredHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0)
        const totalCost = filteredHoldings.reduce((sum, h) => sum + (h.cost_basis || 0), 0)
        const totalGain = totalValue - totalCost
        const dayChangePercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

        const sortedByGain = [...filteredHoldings].sort((a, b) => (b.gain_percent || 0) - (a.gain_percent || 0))
        const topPerformer = sortedByGain.length > 0 ? {
            ticker: sortedByGain[0].ticker,
            change: sortedByGain[0].gain_percent || 0
        } : { ticker: "-", change: 0 }

        return {
            totalValue,
            dayChange: totalGain,
            dayChangePercent,
            topPerformer
        }
    }, [filteredHoldings])

    // Create columns with update callback
    const columns = React.useMemo(() => createColumns(handleHoldingUpdate), [])

    // Get selected portfolio ID for AddHoldingDialog
    const selectedPortfolioId = selectedPortfolio !== "all" ? parseInt(selectedPortfolio) : undefined

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Portfolio</h2>
                    <PortfolioSelector
                        portfolios={portfolios}
                        selectedPortfolio={selectedPortfolio}
                        onSelect={setSelectedPortfolio}
                        onPortfolioCreated={handlePortfolioCreated}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh Prices
                    </Button>
                    <AddHoldingDialog
                        portfolios={portfolios}
                        selectedPortfolioId={selectedPortfolioId}
                        onAdded={handleHoldingAdded}
                    />
                </div>
            </div>

            <PortfolioSummary
                totalValue={metrics.totalValue}
                dayChange={metrics.dayChange}
                dayChangePercent={metrics.dayChangePercent}
                topPerformer={metrics.topPerformer}
            />

            <div className="bg-card text-card-foreground rounded-xl border shadow p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-medium">Holdings</h3>
                    <p className="text-sm text-muted-foreground">Manage your investment positions across all classes.</p>
                </div>
                {filteredHoldings.length > 0 ? (
                    <DataTable columns={columns} data={filteredHoldings} />
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg">No holdings yet</p>
                        <p className="text-sm mt-2">Add your first holding to start tracking your portfolio.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
