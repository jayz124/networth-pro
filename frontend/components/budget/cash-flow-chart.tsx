"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts"
import { CashFlowData } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"
import { LoadingState } from "@/components/ui/loading-state"

interface CashFlowChartProps {
    data: CashFlowData[]
    isLoading?: boolean
}

export function CashFlowChart({ data, isLoading }: CashFlowChartProps) {
    const { formatCurrency, formatCompactCurrency } = useSettings()

    const formatMonth = (month: string) => {
        const [year, m] = month.split("-")
        const date = new Date(parseInt(year), parseInt(m) - 1)
        return date.toLocaleDateString("en-US", { month: "short" })
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Cash Flow</CardTitle>
                    <CardDescription>Income vs expenses over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <LoadingState message="Loading cash flow..." />
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Cash Flow</CardTitle>
                    <CardDescription>Income vs expenses over time</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No data available. Add transactions to see your cash flow.
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cash Flow</CardTitle>
                <CardDescription>Income vs expenses over time</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                tickFormatter={formatMonth}
                                className="text-xs"
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                            />
                            <YAxis
                                tickFormatter={formatCompactCurrency}
                                className="text-xs"
                                tick={{ fill: "hsl(var(--muted-foreground))" }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                }}
                                formatter={(value, name) => [
                                    formatCurrency(typeof value === 'number' ? value : 0),
                                    typeof name === 'string' ? name.charAt(0).toUpperCase() + name.slice(1) : ''
                                ]}
                                labelFormatter={(label) => formatMonth(String(label))}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="income"
                                stroke="#10b981"
                                fillOpacity={1}
                                fill="url(#colorIncome)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorExpenses)"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
