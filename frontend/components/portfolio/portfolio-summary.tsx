"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign } from "lucide-react"

type SummaryProps = {
    totalValue: number
    dayChange: number
    dayChangePercent: number
    topPerformer: {
        ticker: string
        change: number
    }
}

export function PortfolioSummary({ totalValue, dayChange, dayChangePercent, topPerformer }: SummaryProps) {
    const isPositive = dayChange >= 0
    const performerPositive = topPerformer.change >= 0

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                        Across all portfolios
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">24h Change</CardTitle>
                    {isPositive ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                    )}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                        {isPositive ? "+" : ""}{dayChange.toLocaleString()} ({dayChangePercent.toFixed(2)}%)
                    </div>
                    <p className="text-xs text-muted-foreground">
                        +20.1% from last month
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{topPerformer.ticker}</div>
                    <p className={`text-xs ${performerPositive ? "text-emerald-500" : "text-red-500"}`}>
                        {performerPositive ? "+" : ""}{topPerformer.change}% today
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">
                        Across 4 asset classes
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
