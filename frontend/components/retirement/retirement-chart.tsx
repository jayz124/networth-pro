"use client"

import { ProjectionPoint } from "@/lib/retirement-logic"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type RetirementChartProps = {
    data: ProjectionPoint[]
    retirementAge: number
}

export function RetirementChart({ data, retirementAge }: RetirementChartProps) {

    // Find index of retirement for reference line (approximate)
    const retirementYear = data.find(p => p.age === retirementAge)?.year;

    // Formatting currency
    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
        return `$${value}`
    }

    // Check if run out of money
    const runOutPoint = data.find(p => p.netWorth < 0);
    const runOutAge = runOutPoint ? runOutPoint.age : null;

    return (
        <Card className="col-span-1 lg:col-span-2 h-[500px] flex flex-col">
            <CardHeader>
                <CardTitle>Net Worth Projection</CardTitle>
                <CardDescription>
                    {runOutAge
                        ? <span className="text-red-500 font-bold">Projected to run out of money at age {runOutAge}</span>
                        : <span className="text-emerald-500 font-bold">Assets sustain through life expectancy</span>
                    }
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="age"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={(val) => `Age ${val}`}
                            interval="preserveStartEnd"
                            minTickGap={30}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={formatCurrency}
                            width={60}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                            formatter={(value: any) => [formatCurrency(value), "Net Worth"]}
                            labelFormatter={(label) => `Age ${label}`}
                        />
                        {retirementYear && (
                            <ReferenceLine x={retirementAge} stroke="green" strokeDasharray="3 3" label="Retirement" />
                        )}
                        <Area
                            type="monotone"
                            dataKey="netWorth"
                            stroke="#0ea5e9"
                            fill="#0ea5e9"
                            fillOpacity={0.2}
                        />
                        <Area
                            type="monotone"
                            dataKey="expenses"
                            stroke="#ef4444"
                            fill="transparent"
                            name="Expenses"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
