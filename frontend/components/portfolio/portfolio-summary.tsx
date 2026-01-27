"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart3, Briefcase } from "lucide-react"

type SummaryProps = {
    totalValue: number
    dayChange: number
    dayChangePercent: number
    topPerformer: {
        ticker: string
        change: number
    }
    holdingsCount?: number
}

export function PortfolioSummary({ totalValue, dayChange, dayChangePercent, topPerformer, holdingsCount = 0 }: SummaryProps) {
    const isPositive = dayChange >= 0
    const performerPositive = topPerformer.change >= 0

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Value - Hero Card */}
            <Card className="relative overflow-hidden opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.1s_forwards]">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <DollarSign className="h-4 w-4 text-accent" />
                    </div>
                </CardHeader>
                <CardContent className="relative">
                    <div className="text-3xl font-bold tabular-nums tracking-tight">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Across all portfolios
                    </p>
                </CardContent>
            </Card>

            {/* P&L Card */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isPositive ? "bg-success/10" : "bg-destructive/10"}`}>
                        {isPositive ? (
                            <ArrowUpRight className="h-4 w-4 text-success" />
                        ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold tabular-nums ${isPositive ? "text-gain" : "text-loss"}`}>
                        {isPositive ? "+" : ""}{dayChange.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                    </div>
                    <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-1 ${isPositive ? "bg-success/10 text-gain" : "bg-destructive/10 text-loss"
                        }`}>
                        {isPositive ? "+" : ""}{dayChangePercent.toFixed(2)}%
                    </div>
                </CardContent>
            </Card>

            {/* Top Performer Card */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.3s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${performerPositive ? "bg-success/10" : "bg-destructive/10"}`}>
                        <TrendingUp className={`h-4 w-4 ${performerPositive ? "text-success" : "text-destructive"}`} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{topPerformer.ticker}</div>
                    <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mt-1 ${performerPositive ? "bg-success/10 text-gain" : "bg-destructive/10 text-loss"
                        }`}>
                        {performerPositive ? "+" : ""}{topPerformer.change.toFixed(2)}%
                    </div>
                </CardContent>
            </Card>

            {/* Active Positions Card */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.4s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums">{holdingsCount}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Investment positions
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
