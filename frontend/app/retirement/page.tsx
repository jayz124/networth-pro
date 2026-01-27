"use client"

import * as React from "react"
import { calculateProjection, DEFAULT_CONFIG, RetirementConfig } from "@/lib/retirement-logic"
import { ConfigSidebar } from "@/components/retirement/config-sidebar"
import { RetirementChart } from "@/components/retirement/retirement-chart"
import { RetirementSummary } from "@/components/retirement/retirement-summary"
import { MonteCarloDialog } from "@/components/retirement/monte-carlo-dialog"

export default function RetirementPage() {
    // State for configuration
    const [config, setConfig] = React.useState<RetirementConfig>(DEFAULT_CONFIG)

    // Calculate projection whenever config changes
    const projectionData = React.useMemo(() => {
        return calculateProjection(config)
    }, [config])

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-6 p-6">
            {/* Sidebar - Scrollable */}
            <div className="w-full md:w-80 shrink-0 overflow-y-auto pb-8">
                <ConfigSidebar config={config} onChange={setConfig} />
            </div>

            {/* Main Content - Flex Grow */}
            <div className="flex-1 space-y-6 overflow-y-auto pb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Retirement Planner</h2>
                        <p className="text-muted-foreground">Visualize your path to financial freedom.</p>
                    </div>
                    <MonteCarloDialog config={config} />
                </div>

                <RetirementSummary
                    data={projectionData}
                    retirementAge={config.retirementAge}
                    initialNetWorth={config.currentNetWorth}
                />

                <RetirementChart
                    data={projectionData}
                    retirementAge={config.retirementAge}
                />
            </div>
        </div>
    )
}
