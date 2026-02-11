"use client"

import { CreditCard, AlertTriangle, TrendingDown, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings } from "@/lib/settings-context"

type LiabilitySummaryProps = {
    totalDebt: number
    creditCardDebt: number
    loansDebt: number
    otherDebt: number
    liabilityCount?: number
}

export function LiabilitySummary({ totalDebt, creditCardDebt, loansDebt, otherDebt, liabilityCount = 0 }: LiabilitySummaryProps) {
    const { formatCurrency } = useSettings()

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Debt - Hero Card */}
            <Card className="relative overflow-hidden opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.1s_forwards]">
                <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Debt</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                </CardHeader>
                <CardContent className="relative">
                    <div className="text-3xl font-bold tabular-nums tracking-tight text-loss">{formatCurrency(totalDebt)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {liabilityCount} {liabilityCount === 1 ? 'liability' : 'liabilities'}
                    </p>
                </CardContent>
            </Card>

            {/* Credit Cards */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credit Cards</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                        <CreditCard className="h-4 w-4 text-destructive" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-loss">{formatCurrency(creditCardDebt)}</div>
                    <p className="text-xs text-muted-foreground mt-1">High interest debt</p>
                </CardContent>
            </Card>

            {/* Loans */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.3s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Loans</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10">
                        <TrendingDown className="h-4 w-4 text-warning" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-loss">{formatCurrency(loansDebt)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Personal & auto loans</p>
                </CardContent>
            </Card>

            {/* Other */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.4s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Other Debt</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums">{formatCurrency(otherDebt)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Miscellaneous</p>
                </CardContent>
            </Card>
        </div>
    )
}
