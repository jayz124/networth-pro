"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { RetirementConfig } from "@/lib/retirement-logic"
import { runMonteCarlo, SimulationResult } from "@/lib/monte-carlo"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts"
import { Play, Dice6 } from "lucide-react"

export function MonteCarloDialog({ config }: { config: RetirementConfig }) {
    const [result, setResult] = React.useState<SimulationResult | null>(null)
    const [isRunning, setIsRunning] = React.useState(false)

    const handleRun = async () => {
        setIsRunning(true)
        // Yield to render loop to show loading state
        await new Promise(resolve => setTimeout(resolve, 100))
        const res = runMonteCarlo(config, 1000)
        setResult(res)
        setIsRunning(false)
    }

    const formatCurrency = (value: number) => {
        if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
        if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
        return `$${value}`
    }

    // Prepare data for Recharts: merge percentiles
    const chartData = React.useMemo(() => {
        if (!result) return []
        return result.percentile50.map((p, i) => ({
            age: p.age,
            p10: result.percentile10[i]?.netWorth || 0,
            p50: p.netWorth,
            p90: result.percentile90[i]?.netWorth || 0,
        }))
    }, [result])

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Dice6 className="h-4 w-4" />
                    Run Monte Carlo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Dice6 className="h-5 w-5" />
                        Monte Carlo Simulation
                    </DialogTitle>
                    <DialogDescription>
                        Simulating 1,000 market scenarios using historical bootstrapping (1928-2023 data).
                    </DialogDescription>
                </DialogHeader>

                {!result && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg max-w-md text-center">
                            <p className="text-sm text-muted-foreground">
                                Will your plan survive market volatility? Run 1,000 potential future scenarios
                                based on historical market data to see your probability of success.
                            </p>
                        </div>
                        <Button onClick={handleRun} disabled={isRunning} size="lg" className="gap-2">
                            <Play className="h-4 w-4" />
                            {isRunning ? "Simulating..." : "Start Simulation"}
                        </Button>
                        {config.stressTest.enabled && (
                            <p className="text-xs text-amber-500">
                                Note: Stress test scenario will be applied to all simulations.
                            </p>
                        )}
                    </div>
                )}

                {result && (
                    <div className="space-y-6">
                        {/* Results Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium">Success Rate</p>
                                <p className={`text-3xl font-bold ${result.successRate >= 90 ? "text-emerald-500" : result.successRate >= 70 ? "text-amber-500" : "text-red-500"}`}>
                                    {result.successRate.toFixed(1)}%
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {result.successRate >= 90 ? "Excellent - plan is robust" :
                                        result.successRate >= 70 ? "Good - some risk remains" :
                                            "Warning - high failure risk"}
                                </p>
                            </div>
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="text-sm font-medium">Median End Wealth</p>
                                <p className="text-3xl font-bold">
                                    {formatCurrency(result.percentile50[result.percentile50.length - 1]?.netWorth || 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    50th percentile outcome
                                </p>
                            </div>
                        </div>

                        {/* Percentile Range */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-xs text-muted-foreground">Downside (10th)</p>
                                <p className="font-semibold text-red-500">
                                    {formatCurrency(result.percentile10[result.percentile10.length - 1]?.netWorth || 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Median (50th)</p>
                                <p className="font-semibold text-blue-500">
                                    {formatCurrency(result.percentile50[result.percentile50.length - 1]?.netWorth || 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Upside (90th)</p>
                                <p className="font-semibold text-emerald-500">
                                    {formatCurrency(result.percentile90[result.percentile90.length - 1]?.netWorth || 0)}
                                </p>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="age"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickFormatter={(v) => `${v}`}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 11 }}
                                        tickFormatter={formatCurrency}
                                        width={60}
                                    />
                                    <Tooltip
                                        labelFormatter={(l) => `Age ${l}`}
                                        formatter={(v: any, name?: string) => [
                                            formatCurrency(v),
                                            name === 'p90' ? 'Upside (90th)' :
                                                name === 'p50' ? 'Median (50th)' :
                                                    'Downside (10th)'
                                        ]}
                                    />
                                    <ReferenceLine x={config.retirementAge} stroke="#10b981" strokeDasharray="3 3" />
                                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                                    <Area
                                        type="monotone"
                                        dataKey="p90"
                                        stroke="transparent"
                                        fill="#10b981"
                                        fillOpacity={0.15}
                                        name="p90"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="p50"
                                        stroke="#3b82f6"
                                        fill="transparent"
                                        strokeWidth={2}
                                        name="p50"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="p10"
                                        stroke="#ef4444"
                                        fill="transparent"
                                        strokeDasharray="3 3"
                                        name="p10"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="flex justify-center gap-6 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-emerald-500/30 rounded" />
                                <span>Upside (90th percentile)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-blue-500" />
                                <span>Median (50th percentile)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-red-500 border-dashed border-t border-red-500" />
                                <span>Downside (10th percentile)</span>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <p className="text-xs text-muted-foreground max-w-md">
                                Methodology: Historical bootstrapping using 100 years of market data (1928-2023).
                                Captures real-world "fat tail" events better than normal distribution models.
                            </p>
                            <Button variant="outline" onClick={handleRun} disabled={isRunning}>
                                {isRunning ? "Running..." : "Run Again"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
