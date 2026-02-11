"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectionPoint, RetirementConfig, calculateCurrentNetWorth, calculateEffectiveTaxRate } from "@/lib/retirement-logic"
import { Wallet, TrendingUp, Clock, Percent, AlertTriangle } from "lucide-react"
import { useSettings } from "@/lib/settings-context"

type RetirementSummaryProps = {
    data: ProjectionPoint[];
    config: RetirementConfig;
}

export function RetirementSummary({ data, config }: RetirementSummaryProps) {
    const { formatCompactCurrency } = useSettings()

    // Calculate key metrics
    const currentNetWorth = calculateCurrentNetWorth(config)
    const retirementPoint = data.find(p => p.age === config.retirementAge)
    const endPoint = data[data.length - 1]

    const worthAtRetirement = retirementPoint ? retirementPoint.netWorth : 0
    const endOfLifeWorth = endPoint ? endPoint.netWorth : 0

    // Calculate Runway (Age when liquid assets < 0)
    const runOutPoint = data.find(p => p.liquidAssets < 0)
    const runOutAge = runOutPoint ? runOutPoint.age : null

    // Calculate effective tax rate
    const effectiveTaxRate = calculateEffectiveTaxRate(data)

    // Check for shortfall
    const maxShortfall = Math.max(...data.map(p => p.shortfall))
    const hasShortfall = maxShortfall > 0

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Net Worth</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCompactCurrency(currentNetWorth)}</div>
                        <p className="text-xs text-muted-foreground">
                            (real)
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Wealth at Retirement</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${worthAtRetirement < 0 ? "text-loss" : ""}`}>
                            {formatCompactCurrency(worthAtRetirement)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            (real) at age {config.retirementAge}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">End of Life Wealth</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${endOfLifeWorth < 0 ? "text-loss" : "text-gain"}`}>
                            {formatCompactCurrency(endOfLifeWorth)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            (real) at age {endPoint?.age || config.lifeExpectancy}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Runway</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${runOutAge ? "text-warning" : "text-gain"}`}>
                            {runOutAge ? `Depleted at ${runOutAge}` : "Lifetime"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {runOutAge ? "Funds run out" : "Assets last through plan"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Effective Tax Rate</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{effectiveTaxRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            Lifetime average
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Alert for Shortfall */}
            {hasShortfall && (
                <Card className="border-destructive/50 bg-destructive/10">
                    <CardContent className="flex items-center gap-4 py-4">
                        <AlertTriangle className="h-8 w-8 text-loss" />
                        <div>
                            <p className="font-semibold text-loss">Funding Shortfall Detected</p>
                            <p className="text-sm text-muted-foreground">
                                Maximum shortfall of {formatCompactCurrency(maxShortfall)}. Consider adjusting expenses or retirement age.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
