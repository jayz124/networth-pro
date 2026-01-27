"use client"

import * as React from "react"
import { RefreshCcw, Briefcase, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
            topPerformer,
            holdingsCount: filteredHoldings.length
        }
    }, [filteredHoldings])

    // Create columns with update callback
    const columns = React.useMemo(() => createColumns(handleHoldingUpdate), [])

    // Get selected portfolio ID for AddHoldingDialog
    const selectedPortfolioId = selectedPortfolio !== "all" ? parseInt(selectedPortfolio) : undefined

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Portfolio</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track and manage your investments</p>
                </div>
                <div className="flex items-center gap-3">
                    <PortfolioSelector
                        portfolios={portfolios}
                        selectedPortfolio={selectedPortfolio}
                        onSelect={setSelectedPortfolio}
                        onPortfolioCreated={handlePortfolioCreated}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="gap-2"
                    >
                        <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                    <AddHoldingDialog
                        portfolios={portfolios}
                        selectedPortfolioId={selectedPortfolioId}
                        onAdded={handleHoldingAdded}
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <PortfolioSummary
                totalValue={metrics.totalValue}
                dayChange={metrics.dayChange}
                dayChangePercent={metrics.dayChangePercent}
                topPerformer={metrics.topPerformer}
                holdingsCount={metrics.holdingsCount}
            />

            {/* Holdings Table */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.5s_forwards]">
                <CardHeader className="border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Holdings</CardTitle>
                            <CardDescription>
                                Manage your investment positions across all asset classes
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredHoldings.length > 0 ? (
                        <div className="p-6">
                            <DataTable columns={columns} data={filteredHoldings} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
                                <Briefcase className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium">No holdings yet</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                Add your first investment to start tracking your portfolio performance
                            </p>
                            <AddHoldingDialog
                                portfolios={portfolios}
                                selectedPortfolioId={selectedPortfolioId}
                                onAdded={handleHoldingAdded}
                                trigger={
                                    <Button variant="accent" className="mt-6 gap-2">
                                        <Plus className="h-4 w-4" />
                                        Add First Holding
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
