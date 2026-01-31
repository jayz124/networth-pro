"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { useSettings } from "@/lib/settings-context"

interface BudgetSummaryProps {
    totalIncome: number
    totalExpenses: number
    transactionCount: number
    previousIncome?: number
    previousExpenses?: number
}

export function BudgetSummary({
    totalIncome,
    totalExpenses,
    transactionCount,
    previousIncome,
    previousExpenses,
}: BudgetSummaryProps) {
    const { formatCurrency } = useSettings()
    const net = totalIncome - totalExpenses

    const incomeChange = previousIncome && previousIncome > 0
        ? ((totalIncome - previousIncome) / previousIncome) * 100
        : null

    const expenseChange = previousExpenses && previousExpenses > 0
        ? ((totalExpenses - previousExpenses) / previousExpenses) * 100
        : null

    const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Income Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Income</CardTitle>
                    <TrendingUp className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success">
                        {formatCurrency(totalIncome)}
                    </div>
                    {incomeChange !== null && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {incomeChange >= 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-success" />
                            ) : (
                                <ArrowDownRight className="h-3 w-3 text-destructive" />
                            )}
                            <span className={incomeChange >= 0 ? "text-success" : "text-destructive"}>
                                {Math.abs(incomeChange).toFixed(1)}%
                            </span>
                            <span>vs last month</span>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Expenses Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Expenses</CardTitle>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                        {formatCurrency(totalExpenses)}
                    </div>
                    {expenseChange !== null && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {expenseChange >= 0 ? (
                                <ArrowUpRight className="h-3 w-3 text-destructive" />
                            ) : (
                                <ArrowDownRight className="h-3 w-3 text-success" />
                            )}
                            <span className={expenseChange <= 0 ? "text-success" : "text-destructive"}>
                                {Math.abs(expenseChange).toFixed(1)}%
                            </span>
                            <span>vs last month</span>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Net Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>
                        {net >= 0 ? "+" : ""}{formatCurrency(net)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {transactionCount} transactions
                    </p>
                </CardContent>
            </Card>

            {/* Savings Rate Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Savings Rate</CardTitle>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded ${
                        savingsRate >= 20 ? "bg-success/10 text-success" :
                        savingsRate >= 10 ? "bg-yellow-500/10 text-yellow-600" :
                        "bg-destructive/10 text-destructive"
                    }`}>
                        {savingsRate >= 20 ? "Great" : savingsRate >= 10 ? "Good" : "Low"}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {savingsRate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Target: 20%+
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
