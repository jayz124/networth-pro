"use client"

import { Wallet, Building, TrendingUp, PiggyBank } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSettings } from "@/lib/settings-context"

type AccountSummaryProps = {
    totalBalance: number
    checkingBalance: number
    savingsBalance: number
    investmentBalance: number
    accountCount?: number
}

export function AccountSummary({ totalBalance, checkingBalance, savingsBalance, investmentBalance, accountCount = 0 }: AccountSummaryProps) {
    const { formatCurrency } = useSettings()

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Balance - Hero Card */}
            <Card className="relative overflow-hidden opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.1s_forwards]">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        <Wallet className="h-4 w-4 text-accent" />
                    </div>
                </CardHeader>
                <CardContent className="relative">
                    <div className="text-3xl font-bold tabular-nums tracking-tight">{formatCurrency(totalBalance)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
                    </p>
                </CardContent>
            </Card>

            {/* Checking */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.2s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Checking</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                        <Building className="h-4 w-4 text-blue-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums">{formatCurrency(checkingBalance)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Daily expenses</p>
                </CardContent>
            </Card>

            {/* Savings */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.3s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Savings</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                        <PiggyBank className="h-4 w-4 text-success" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-gain">{formatCurrency(savingsBalance)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Emergency fund</p>
                </CardContent>
            </Card>

            {/* Investment Cash */}
            <Card className="opacity-0 animate-[slide-up-fade_0.5s_ease-out_0.4s_forwards]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Investment Cash</CardTitle>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
                        <TrendingUp className="h-4 w-4 text-violet-500" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold tabular-nums">{formatCurrency(investmentBalance)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Brokerage cash</p>
                </CardContent>
            </Card>
        </div>
    )
}
