"use client"

import * as React from "react"
import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PortfolioSelector } from "@/components/portfolio/portfolio-selector"
import { PortfolioSummary } from "@/components/portfolio/portfolio-summary"
import { DataTable } from "@/components/portfolio/data-table"
import { columns, Holding } from "@/components/portfolio/columns"
import { AddHoldingDialog } from "@/components/portfolio/add-holding-dialog"

type PortfolioContentProps = {
    initialHoldings: Holding[]
}

export function PortfolioContent({ initialHoldings }: PortfolioContentProps) {
    const [selectedPortfolio, setSelectedPortfolio] = React.useState("all")
    const [holdings, setHoldings] = React.useState<Holding[]>(initialHoldings)
    const [isRefreshing, setIsRefreshing] = React.useState(false)

    // Filter holdings based on selection
    const filteredHoldings = React.useMemo(() => {
        if (selectedPortfolio === "all") return holdings
        return holdings.filter(h => h.portfolioId === selectedPortfolio)
    }, [selectedPortfolio, holdings])

    // Calculate metrics
    const metrics = React.useMemo(() => {
        const totalValue = filteredHoldings.reduce((sum, h) => sum + (h.current_value || 0), 0)

        // Mock day change calculation properly based on individual asset changes
        // In reality this would be weighted
        const weightedChangeSum = filteredHoldings.reduce((sum, h) => {
            const val = h.current_value || 0
            const change = h.change_24h || 0
            return sum + (val * (change / 100))
        }, 0)

        const dayChange = weightedChangeSum
        const dayChangePercent = totalValue > 0 ? (dayChange / totalValue) * 100 : 0

        const sortedByPerf = [...filteredHoldings].sort((a, b) => (b.change_24h || 0) - (a.change_24h || 0))
        const topPerformer = sortedByPerf.length > 0 ? {
            ticker: sortedByPerf[0].ticker,
            change: sortedByPerf[0].change_24h || 0
        } : { ticker: "-", change: 0 }

        return {
            totalValue,
            dayChange,
            dayChangePercent,
            topPerformer
        }
    }, [filteredHoldings])

    const handleRefresh = async () => {
        setIsRefreshing(true)
        // Simulate API delay and price updates
        await new Promise(resolve => setTimeout(resolve, 800))

        // Randomly fluctuate prices slightly for effect
        const updated = holdings.map(h => ({
            ...h,
            current_value: (h.current_value || 0) * (1 + (Math.random() * 0.02 - 0.01)),
            change_24h: (h.change_24h || 0) + (Math.random() * 0.5 - 0.25)
        }))

        setHoldings(updated)
        setIsRefreshing(false)
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Portfolio</h2>
                    <PortfolioSelector
                        selectedPortfolio={selectedPortfolio}
                        onSelect={setSelectedPortfolio}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh Values
                    </Button>
                    <AddHoldingDialog />
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
                <DataTable columns={columns} data={filteredHoldings} />
            </div>
        </div>
    )
}
