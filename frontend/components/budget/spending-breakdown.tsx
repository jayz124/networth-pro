"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Legend,
    Tooltip,
} from "recharts"
import { BudgetSummary } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

interface SpendingBreakdownProps {
    summary: BudgetSummary | null
    isLoading?: boolean
}

export function SpendingBreakdown({ summary, isLoading }: SpendingBreakdownProps) {
    const { formatCurrency } = useSettings()

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Where your money goes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">Loading...</div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!summary || summary.by_category.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Where your money goes</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No spending data available.
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Filter to only expenses and prepare data
    const chartData = summary.by_category
        .filter(cat => cat.expenses > 0)
        .map(cat => ({
            name: cat.category_name,
            value: cat.expenses,
            color: cat.category_color || "#64748b",
        }))
        .slice(0, 8)  // Limit to top 8 categories

    return (
        <Card>
            <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
                <CardDescription>Where your money goes this month</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) =>
                                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                                }
                                labelLine={false}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                                formatter={(value) => [formatCurrency(typeof value === 'number' ? value : 0), "Amount"]}
                            />
                            <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                formatter={(value) => (
                                    <span className="text-sm text-foreground">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Category List with Budget Progress */}
                <div className="mt-4 space-y-2">
                    {summary.by_category
                        .filter(cat => cat.expenses > 0)
                        .slice(0, 5)
                        .map((cat) => {
                            const budgetPercent = cat.budget_limit
                                ? (cat.expenses / cat.budget_limit) * 100
                                : null

                            return (
                                <div key={cat.category_id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: cat.category_color }}
                                        />
                                        <span>{cat.category_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{formatCurrency(cat.expenses)}</span>
                                        {budgetPercent !== null && (
                                            <span className={`text-xs ${
                                                budgetPercent > 100 ? "text-destructive" :
                                                budgetPercent > 80 ? "text-warning" :
                                                "text-muted-foreground"
                                            }`}>
                                                ({budgetPercent.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                </div>
            </CardContent>
        </Card>
    )
}
