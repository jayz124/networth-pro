"use client"

import { Building2, DollarSign, TrendingUp, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings } from "@/lib/settings-context"

type PropertySummaryProps = {
    totalValue: number
    totalEquity: number
    totalMortgage: number
    monthlyPayments: number
    propertyCount?: number
}

export function PropertySummary({ totalValue, totalEquity, totalMortgage, monthlyPayments, propertyCount = 0 }: PropertySummaryProps) {
    const { formatCurrency } = useSettings()

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Property Value - Hero Card */}
            <Card className="relative overflow-hidden opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.1s_forwards]">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Property Value</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <Building2 className="h-4 w-4 text-accent" />
                    </div>
                </CardHeader>
                <CardContent className="relative">
                    <div className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(totalValue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
                    </p>
                </CardContent>
            </Card>

            {/* Total Equity */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                        <TrendingUp className="h-4 w-4 text-success" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-gain">{formatCurrency(totalEquity)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Value minus mortgages</p>
                </CardContent>
            </Card>

            {/* Outstanding Mortgages */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.3s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mortgages</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                        <CreditCard className="h-4 w-4 text-destructive" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-loss">{formatCurrency(totalMortgage)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Balance remaining</p>
                </CardContent>
            </Card>

            {/* Monthly Payments */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.4s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Monthly Payment</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums">{formatCurrency(monthlyPayments)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Combined mortgages</p>
                </CardContent>
            </Card>
        </div>
    )
}
