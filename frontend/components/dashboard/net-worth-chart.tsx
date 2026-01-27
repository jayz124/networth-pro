"use client"

import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface HistoryData {
    date: string
    net_worth: number
    assets: number
    liabilities: number
}

export function NetWorthChart({ data }: { data: HistoryData[] }) {
    if (!data || data.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>Net Worth History</CardTitle>
                    <CardDescription>No historical data available yet</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center">
                    <div className="text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                        </div>
                        <p className="text-sm text-muted-foreground">Waiting for more snapshots...</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Net Worth History</CardTitle>
                <CardDescription>
                    Wealth trajectory over time
                </CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                {/* Gold/Amber gradient for the area fill */}
                                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                                    <stop offset="50%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                                </linearGradient>
                                {/* Glow filter for the line */}
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                    <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                }}
                                dy={10}
                            />
                            <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                dx={-10}
                            />
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="hsl(var(--border))"
                                strokeOpacity={0.5}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    borderRadius: "8px",
                                    border: "1px solid hsl(var(--border))",
                                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                                    padding: "12px 16px"
                                }}
                                labelStyle={{
                                    color: "hsl(var(--foreground))",
                                    fontWeight: 600,
                                    marginBottom: "4px"
                                }}
                                itemStyle={{
                                    color: "hsl(var(--muted-foreground))"
                                }}
                                formatter={(value: any) => [
                                    <span key="value" style={{ color: "hsl(38, 92%, 50%)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                                        ${value.toLocaleString()}
                                    </span>,
                                    "Net Worth"
                                ]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric"
                                })}
                            />
                            <Area
                                type="monotone"
                                dataKey="net_worth"
                                stroke="hsl(38, 92%, 50%)"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorNetWorth)"
                                filter="url(#glow)"
                                animationDuration={1500}
                                animationEasing="ease-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
