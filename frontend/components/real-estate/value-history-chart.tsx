"use client"

import * as React from "react"
import { Loader2, TrendingUp } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts"
import { getPropertyValueHistory, PropertyValueHistoryPoint } from "@/lib/api"
import { useSettings } from "@/lib/settings-context"

type ValueHistoryChartProps = {
    propertyId: number
    propertyName: string
    purchasePrice: number
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ValueHistoryChart({
    propertyId,
    propertyName,
    purchasePrice,
    open,
    onOpenChange,
}: ValueHistoryChartProps) {
    const [history, setHistory] = React.useState<PropertyValueHistoryPoint[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const { formatCurrency, formatCompactCurrency } = useSettings()

    React.useEffect(() => {
        if (open) {
            setIsLoading(true)
            getPropertyValueHistory(propertyId).then((data) => {
                setHistory(data)
                setIsLoading(false)
            })
        }
    }, [open, propertyId])

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + "T00:00:00")
        return date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-success" />
                        Value History
                    </DialogTitle>
                    <DialogDescription>
                        Estimated value over time for {propertyName}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            No value history yet. Refresh the property valuation to start tracking.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={formatDate}
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={formatCompactCurrency}
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={60}
                                    />
                                    <Tooltip
                                        labelFormatter={(label) => formatDate(String(label))}
                                        formatter={(value) => [formatCurrency(Number(value)), "Estimated Value"]}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            border: "1px solid hsl(var(--border))",
                                            borderRadius: "8px",
                                            fontSize: "13px",
                                        }}
                                    />
                                    {purchasePrice > 0 && (
                                        <ReferenceLine
                                            y={purchasePrice}
                                            stroke="hsl(var(--muted-foreground))"
                                            strokeDasharray="3 3"
                                            label={{
                                                value: `Purchase: ${formatCompactCurrency(purchasePrice)}`,
                                                position: "insideTopRight",
                                                fontSize: 11,
                                                fill: "hsl(var(--muted-foreground))",
                                            }}
                                        />
                                    )}
                                    <Area
                                        type="monotone"
                                        dataKey="estimated_value"
                                        stroke="hsl(var(--success))"
                                        strokeWidth={2}
                                        fill="url(#valueGradient)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
                            <span>{history.length} data point{history.length !== 1 ? "s" : ""}</span>
                            <span>
                                Sources: {[...new Set(history.map(h => h.source))].join(", ")}
                            </span>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
