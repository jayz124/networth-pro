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
import { tooltipContentStyle, chartColors, defaultAxisProps, gridProps } from "@/lib/chart-theme"

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
                                    <stop offset="5%" stopColor={chartColors.gain} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartColors.gain} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColors.loss} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartColors.loss} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid {...gridProps} />
                            <XAxis
                                dataKey="month"
                                {...defaultAxisProps}
                                tickFormatter={formatMonth}
                                dy={8}
                            />
                            <YAxis
                                {...defaultAxisProps}
                                tickFormatter={formatCompactCurrency}
                                width={70}
                                dx={-5}
                            />
                            <Tooltip
                                contentStyle={tooltipContentStyle}
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
                                stroke={chartColors.gain}
                                fillOpacity={1}
                                fill="url(#colorIncome)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="expenses"
                                stroke={chartColors.loss}
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
