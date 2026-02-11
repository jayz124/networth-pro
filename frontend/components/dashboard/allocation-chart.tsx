"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useSettings } from "@/lib/settings-context"
import { tooltipContentStyle, allocationColors } from "@/lib/chart-theme"

interface AssetData {
    name: string
    balance: number
    currency: string
}

export function AllocationChart({ assets }: { assets: AssetData[] }) {
    const { formatCurrency } = useSettings()
    // Filter out tiny balances for cleaner chart
    const data = assets
        .filter(a => a.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 6); // Top 6 only

    if (data.length === 0) {
        return (
            <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>Asset Allocation</CardTitle>
                    <CardDescription>No assets to display.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Add assets to see allocation
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Asset Allocation</CardTitle>
                <CardDescription>Distribution by asset.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="balance"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={allocationColors[index % allocationColors.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: any) => [formatCurrency(value), "Value"]}
                                contentStyle={tooltipContentStyle}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
