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
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Play } from "lucide-react"

export function MonteCarloDialog({ config }: { config: RetirementConfig }) {
    const [result, setResult] = React.useState<SimulationResult | null>(null)
    const [isRunning, setIsRunning] = React.useState(false)

    const handleRun = async () => {
        setIsRunning(true)
        // Yield to render loop to show loading state if needed
        await new Promise(resolve => setTimeout(resolve, 100))
        const res = runMonteCarlo(config)
        setResult(res)
        setIsRunning(false)
    }

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
        return `$${value}`
    }

    // Prepare data for Recharts: merge percentiles
    const chartData = React.useMemo(() => {
        if (!result) return []
        return result.percentile50.map((p, i) => ({
            age: p.age,
            p10: result.percentile10[i].netWorth,
            p50: p.netWorth,
            p90: result.percentile90[i].netWorth,
        }))
    }, [result])

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Play className="h-4 w-4" />
                    Run Monte Carlo Simalution
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Monte Carlo Stress Test</DialogTitle>
                    <DialogDescription>
                        Simulating 500 market scenarios with random volatility.
                    </DialogDescription>
                </DialogHeader>

                {!result && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <p className="text-muted-foreground text-center max-w-sm">
                            Will your plan survive a market crash? Run 500 potential future scenarios to see your probability of success.
                        </p>
                        <Button onClick={handleRun} disabled={isRunning}>
                            {isRunning ? "Simulating..." : "Start Simulation"}
                        </Button>
                    </div>
                )}

                {result && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div>
                                <p className="text-sm font-medium">Success Rate</p>
                                <p className={`text-3xl font-bold ${result.successRate > 90 ? "text-emerald-500" : "text-orange-500"}`}>
                                    {result.successRate.toFixed(1)}%
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium">Median End Wealth</p>
                                <p className="text-xl font-bold">
                                    {formatCurrency(result.percentile50[result.percentile50.length - 1].netWorth)}
                                </p>
                            </div>
                        </div>

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="age" tickLine={false} axisLine={false} tickFormatter={(v) => `Age ${v}`} />
                                    <YAxis tickLine={false} axisLine={false} tickFormatter={formatCurrency} width={60} />
                                    <Tooltip labelFormatter={(l) => `Age ${l}`} formatter={(v: any) => formatCurrency(v)} />

                                    <Area type="monotone" dataKey="p90" stroke="transparent" fill="#10b981" fillOpacity={0.1} name="Upside (90th)" />
                                    <Area type="monotone" dataKey="p50" stroke="#0ea5e9" fill="transparent" strokeWidth={2} name="Median" />
                                    <Area type="monotone" dataKey="p10" stroke="#ef4444" fill="transparent" strokeDasharray="3 3" name="Downside (10th)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex justify-end">
                            <Button variant="ghost" onClick={handleRun}>Run Again</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
